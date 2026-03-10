"""
CloudDrop — Upload Lambda Function
Generates a presigned S3 URL for direct browser-to-S3 upload
and records metadata in DynamoDB.
"""
import json
import os
import uuid
import time
import boto3
from botocore.config import Config

# AWS Clients
s3_client = boto3.client('s3', config=Config(signature_version='s3v4'))
dynamodb = boto3.resource('dynamodb')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'clouddrop-files')
TABLE_NAME = os.environ.get('TABLE_NAME', 'CloudDropShares')
PRESIGNED_URL_EXPIRY = 3600  # 1 hour to complete upload

# CORS headers
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}


def lambda_handler(event, context):
    """Handle upload request — generate presigned URL and store metadata."""

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', 'untitled')
        file_type = body.get('fileType', 'application/octet-stream')
        file_size = body.get('fileSize', 0)
        share_code = body.get('shareCode')
        expiry = body.get('expiry', 86400)  # Default 24 hours

        if not share_code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'shareCode is required'})
            }

        # Generate unique S3 key
        file_id = str(uuid.uuid4())
        s3_key = f"uploads/{share_code}/{file_id}/{file_name}"

        # Generate presigned PUT URL
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': file_type
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )

        # Generate presigned GET URL for later retrieval
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key
            },
            ExpiresIn=max(expiry, 86400) if expiry > 0 else 2592000  # At least 24h or 30 days
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
            'downloadUrl': download_url,
            'contentType': 'file',
            'expiry': expiry,
            'createdAt': now,
            'expiresAt': now + expiry if expiry > 0 else 0,
            'ttl': now + expiry if expiry > 0 else 0  # DynamoDB TTL
        }
        table.put_item(Item=item)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'uploadUrl': presigned_url,
                'downloadUrl': download_url,
                'shareCode': share_code,
                'fileId': file_id
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
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
