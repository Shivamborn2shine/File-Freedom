"""
CloudDrop — Download Proxy Lambda Function
Serves files from S3 through API Gateway, avoiding presigned URL issues.
Returns file content as base64 for API Gateway binary support.
"""
import json
import os
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

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
}


def lambda_handler(event, context):
    """Download a file by share code — proxies from S3 through Lambda."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        path_params = event.get('pathParameters', {}) or {}
        share_code = path_params.get('code')

        if not share_code:
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Share code is required'})
            }

        # Look up the share in DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('shareCode').eq(share_code)
        )

        items = response.get('Items', [])
        if not items:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Share not found'})
            }

        first_item = items[0]
        s3_key = first_item.get('s3Key', '')
        file_type = first_item.get('fileType', 'application/octet-stream')
        file_name = first_item.get('fileName', 'download')

        if not s3_key:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'File not found'})
            }

        # Fetch file from S3
        s3_response = s3_client.get_object(Bucket=BUCKET_NAME, Key=s3_key)
        file_bytes = s3_response['Body'].read()

        # Return as base64 with binary content type
        return {
            'statusCode': 200,
            'headers': {
                **CORS_HEADERS,
                'Content-Type': file_type,
                'Content-Disposition': f'inline; filename="{file_name}"',
            },
            'body': base64.b64encode(file_bytes).decode('utf-8'),
            'isBase64Encoded': True
        }

    except Exception as e:
        print(f"Download error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Download failed: {str(e)}'})
        }
