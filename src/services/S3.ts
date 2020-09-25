import aws from 'aws-sdk';
import config from 'config';

const ID: string = config.get('awsAccessKeyId');
const SECRET: string = config.get('awsSecretAccessKey');
export const BUCKET_NAME: string = config.get('awsBucketName');
const REGION: string = config.get('awsRegion');

export const s3 = new aws.S3({
	accessKeyId: ID,
	secretAccessKey: SECRET,
	region: REGION,
});
