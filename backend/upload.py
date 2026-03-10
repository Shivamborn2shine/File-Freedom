"""
CloudDrop — Upload Lambda Function
Receives file data (base64) from the browser and uploads to S3.
This approach avoids S3 CORS issues by proxying through Lambda.
"""
import json
import os
import uuid
import time
import base64
import boto3
from botocore.config import Config

# AWS Clients
region = os.environ.get('AWS_REGION', 'ap-south-1')
s3_client = boto3.client(
    's3',
    region_name=region,
    config=Config(signature_version='s3v4')
)
dynamodb = boto3.resource('dynamodb')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'clouddrop-files')
TABLE_NAME = os.environ.get('TABLE_NAME', 'CloudDropShares')

# CORS headers
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}


def lambda_handler(event, context):
    """Handle upload — receive base64 file data, store in S3, save metadata."""

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', 'untitled')
        file_type = body.get('fileType', 'application/octet-stream')
        file_size = body.get('fileSize', 0)
        share_code = body.get('shareCode')
        expiry = body.get('expiry', 86400)
        file_data_b64 = body.get('fileData')  # base64-encoded file content

        if not share_code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'shareCode is required'})
            }

        if not file_data_b64:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'fileData is required'})
            }

        # Decode file data
        file_bytes = base64.b64decode(file_data_b64)

        # Generate unique S3 key
        file_id = str(uuid.uuid4())
        s3_key = f"uploads/{share_code}/{file_id}/{file_name}"

        # Upload to S3 directly from Lambda
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=file_type
        )

        # Store metadata in DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        now = int(time.time())
        item = {
            'shareCode': share_code,
            'fileId': file_id,
            'fileName': file_name,
            'fileType': file_type,
            'fileSize': file_size,
            'fileCategory': _get_category(file_name, file_type),
            's3Key': s3_key,
            'contentType': 'file',
            'expiry': expiry,
            'createdAt': now,
            'expiresAt': now + expiry if expiry > 0 else 0,
            'ttl': now + expiry if expiry > 0 else 0
        }
        table.put_item(Item=item)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'shareCode': share_code,
                'fileId': file_id,
                'message': 'File uploaded successfully'
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Upload error: {str(e)}'})
        }


def _get_category(file_name, file_type):
    """Determine file category from MIME type or extension."""
    if file_type.startswith('image/'):
        return 'image'
    if file_type.startswith('video/'):
        return 'video'
    if file_type.startswith('text/'):
        return 'text'

    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
    text_exts = {'js', 'py', 'html', 'css', 'json', 'xml', 'md', 'yml', 'yaml', 'ts', 'jsx', 'tsx'}
    doc_exts = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'}

    if ext in text_exts:
        return 'text'
    if ext in doc_exts:
        return 'document'
    return 'other'
