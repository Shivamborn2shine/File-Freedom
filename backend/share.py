"""
CloudDrop — Share Lookup Lambda Function
Returns metadata and download URL for a given share code.
"""
import json
import os
import time
import boto3

from botocore.config import Config

dynamodb = boto3.resource('dynamodb')
region = os.environ.get('AWS_REGION', 'ap-south-1')
s3_client = boto3.client(
    's3',
    region_name=region,
    config=Config(signature_version='s3v4')
)

TABLE_NAME = os.environ.get('TABLE_NAME', 'CloudDropShares')
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'clouddrop-files')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
}


def lambda_handler(event, context):
    """Look up a share code and return its metadata."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        # Extract share code from path parameters
        path_params = event.get('pathParameters', {}) or {}
        share_code = path_params.get('code')

        if not share_code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Share code is required'})
            }

        table = dynamodb.Table(TABLE_NAME)

        # Query all items with this share code
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('shareCode').eq(share_code)
        )

        items = response.get('Items', [])

        if not items:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Share not found or expired'})
            }

        first_item = items[0]
        now = int(time.time())

        # Check expiry
        expires_at = int(first_item.get('expiresAt', 0))
        if expires_at > 0 and now > expires_at:
            return {
                'statusCode': 410,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'This share has expired'})
            }

        content_type = first_item.get('contentType', 'file')

        if content_type == 'text':
            # Text share — return content directly
            result = {
                'type': 'text',
                'content': first_item.get('textContent', ''),
                'expiry': int(first_item.get('expiry', 0)),
                'created': int(first_item.get('createdAt', 0)) * 1000,  # Convert to ms
                'shareCode': share_code
            }
        else:
            # File share — generate fresh presigned URLs
            files = []
            for item in items:
                s3_key = item.get('s3Key', '')
                expiry_val = int(item.get('expiry', 86400))
                download_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': s3_key},
                    ExpiresIn=max(expiry_val, 3600)
                ) if s3_key else ''

                files.append({
                    'name': item.get('fileName', 'untitled'),
                    'type': item.get('fileType', 'application/octet-stream'),
                    'size': int(item.get('fileSize', 0)),
                    'category': item.get('fileCategory', 'other'),
                    'url': download_url,
                    'dataUrl': None
                })

            result = {
                'type': 'file',
                'files': files,
                'expiry': int(first_item.get('expiry', 0)),
                'created': int(first_item.get('createdAt', 0)) * 1000,
                'shareCode': share_code
            }

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }
