"""
CloudDrop — Text Share Lambda Function
Stores text content in DynamoDB (or S3 for large text) and returns a share code.
"""
import json
import os
import uuid
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
MAX_DYNAMO_TEXT = 350000  # ~350KB limit for DynamoDB item size safety

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}


def lambda_handler(event, context):
    """Handle text share request."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body', '{}'))
        content = body.get('content', '')
        share_code = body.get('shareCode')
        expiry = body.get('expiry', 86400)

        if not content:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Content is required'})
            }

        if not share_code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'shareCode is required'})
            }

        now = int(time.time())
        file_id = str(uuid.uuid4())

        table = dynamodb.Table(TABLE_NAME)
        item = {
            'shareCode': share_code,
            'fileId': file_id,
            'contentType': 'text',
            'expiry': expiry,
            'createdAt': now,
            'expiresAt': now + expiry if expiry > 0 else 0,
            'ttl': now + expiry if expiry > 0 else 0
        }

        if len(content.encode('utf-8')) <= MAX_DYNAMO_TEXT:
            # Small text — store directly in DynamoDB
            item['textContent'] = content
            item['storageType'] = 'dynamo'
        else:
            # Large text — store in S3
            s3_key = f"texts/{share_code}/{file_id}.txt"
            s3_client.put_object(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Body=content.encode('utf-8'),
                ContentType='text/plain'
            )
            item['s3Key'] = s3_key
            item['storageType'] = 's3'

        table.put_item(Item=item)

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({
                'shareCode': share_code,
                'message': 'Text shared successfully'
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Internal server error'})
        }
