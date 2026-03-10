"""
CloudDrop — Cleanup Lambda Function
Scheduled via EventBridge to delete expired shares from DynamoDB and S3.
Note: DynamoDB TTL handles most deletions, but this ensures S3 objects are also cleaned up.
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
    """Scan for expired items and clean up S3 objects."""

    table = dynamodb.Table(TABLE_NAME)
    now = int(time.time())
    deleted_count = 0
    errors = []

    try:
        # Scan for expired items (expiresAt > 0 AND expiresAt < now)
        response = table.scan(
            FilterExpression='expiresAt > :zero AND expiresAt < :now',
            ExpressionAttributeValues={
                ':zero': 0,
                ':now': now
            }
        )

        items = response.get('Items', [])

        for item in items:
            share_code = item.get('shareCode')
            file_id = item.get('fileId')
            s3_key = item.get('s3Key', '')

            try:
                # Delete S3 object if present
                if s3_key:
                    s3_client.delete_object(
                        Bucket=BUCKET_NAME,
                        Key=s3_key
                    )

                # Delete DynamoDB record
                table.delete_item(
                    Key={
                        'shareCode': share_code,
                        'fileId': file_id
                    }
                )

                deleted_count += 1

            except Exception as item_err:
                errors.append(f"Failed to delete {share_code}/{file_id}: {str(item_err)}")

        # Handle pagination (scan may not return all items)
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression='expiresAt > :zero AND expiresAt < :now',
                ExpressionAttributeValues={
                    ':zero': 0,
                    ':now': now
                },
                ExclusiveStartKey=response['LastEvaluatedKey']
            )

            for item in response.get('Items', []):
                share_code = item.get('shareCode')
                file_id = item.get('fileId')
                s3_key = item.get('s3Key', '')

                try:
                    if s3_key:
                        s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)

                    table.delete_item(
                        Key={
                            'shareCode': share_code,
                            'fileId': file_id
                        }
                    )
                    deleted_count += 1

                except Exception as item_err:
                    errors.append(f"Failed to delete {share_code}/{file_id}: {str(item_err)}")

        result = {
            'message': f'Cleanup complete. Deleted {deleted_count} expired item(s).',
            'deleted': deleted_count,
            'errors': errors
        }

        print(json.dumps(result))

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps(result)
        }

    except Exception as e:
        print(f"Cleanup error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': str(e)})
        }
