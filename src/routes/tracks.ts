import { Router, Request } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import aws from 'aws-sdk';
import multerS3 from 'multer-s3';
import config from 'config';
import express from 'express';

const ID: string = config.get('awsAccessKeyId');
const SECRET: string = config.get('awsSecretAccessKey');
const BUCKET_NAME: string = config.get('awsBucketName');

const s3 = new aws.S3({
	accessKeyId: ID,
	secretAccessKey: SECRET,
});

const router = Router();

interface TrackImages {
	name: String;
	size: Number;
	imageKey: String;
}
interface Track {
	name: String;
	duration: Number;
	images: TrackImages[];
	artists: Array<String>;
}
interface TrackSchema extends Track, mongoose.Document {}

const trackSchema = new mongoose.Schema({
	name: String,
	duration: Number,
	images: [{ name: String, size: Number, imageKey: String }],
	artists: [String],
});

const Track = mongoose.model<TrackSchema>('Track', trackSchema, 'tracks');

const newTrack = async (track: Track) => {
	const newTrack = new Track(track);
	const savedTrack = await newTrack.save();
	console.log(savedTrack);
};

let upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: BUCKET_NAME,
		metadata: function (req, file, cb) {
			cb(null, { fieldName: file.fieldname });
		},
		key: function (req, file, cb) {
			// console.log(file);
			cb(null, Date.now().toString());
		},
		serverSideEncryption: 'AES256',
	}),
});

const list: any = [];

router.get('/', async (req, res) => {
	const imgs: any = [];
	const getImages = async () => {
		for (let image of list[0].images as Array<{ imageKey: string }>) {
			const base64 = await s3
				.getObject({
					Bucket: BUCKET_NAME,
					Key: image.imageKey,
				})
				.promise();
			imgs.push(base64.Body!.toString('base64'));
		}

		// (list[0].images as Array<{ imageKey: string }>).forEach(async image => {
		// 	const base64 = await s3
		// 		.getObject({
		// 			Bucket: BUCKET_NAME,
		// 			Key: image.imageKey,
		// 		})
		// 		.promise();
		// 	imgs.push(base64.Body!.toString('base64'));
		// 	// console.log(base64);
		// });
	};

	// await // let image = await s3
	// 	.getObject({
	// 		Bucket: BUCKET_NAME,
	// 		Key: list[0].images[0].imageKey,
	// 	})
	// 	.promise();

	// objectStream.on('data')
	// console.log(objectPromise.Body);
	// const images = await Promise.all(imgs);
	// console.log(images);
	// console.log(imgs);
	await getImages();
	res.send({ ...list[0], imagesSrc: imgs }).status(200);

	// objectPromise.on('httpDownloadProgress', (progress, data) =>
	// 	console.log(progress, data)
	// );
});
router.post(
	'/',
	upload.array('images', 10),
	async (
		req: Request<{}, {}, { name: string; duration: number; artists: string[] }>,
		res
	) => {
		const { artists, duration, name } = req.body;

		const validateSchema = {
			name: Joi.string().min(5).max(25).required(),
			duration: Joi.number().required(),
			artists: Joi.array().items(Joi.string()).required(),
		};

		const { error } = Joi.object(validateSchema).validate({
			artists,
			duration,
			name,
		});
		if (error) return res.status(400).send(error.details[0].message);

		let images: TrackImages[] = [];

		if (!Array.isArray(req.files)) {
			const files = req.files['images'];

			files.forEach((file: any) =>
				images.push({
					name: file.originalname,
					size: file.size,
					imageKey: file.key,
				})
			);
		} else {
			req.files.forEach((file: any) =>
				images.push({
					name: file.originalname,
					size: file.size,
					imageKey: file.key,
				})
			);
		}
		await newTrack({ artists, duration, name, images });
		res.status(200).send('Done');
	}
);

export default router;
