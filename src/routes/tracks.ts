import { Router, Request } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import aws from 'aws-sdk';
// import multerS3 from 'multer-s3';
import config from 'config';
// import express from 'express';
// import fs from 'fs';

const ID: string = config.get('awsAccessKeyId');
const SECRET: string = config.get('awsSecretAccessKey');
const BUCKET_NAME: string = config.get('awsBucketName');

const s3 = new aws.S3({
	accessKeyId: ID,
	secretAccessKey: SECRET,
});

const router = Router();
let parseFormData = multer();

interface TrackImage {
	name: String;
	size: Number;
	imageKey: String;
}
interface TrackFile {
	name: String;
	trackKey: String;
	size: Number;
}
interface Track {
	name: String;
	duration: Number;
	images: TrackImage[];
	artists: Array<String>;
	trackFile: TrackFile;
}
interface TrackSchema extends Track, mongoose.Document {}

const trackSchema = new mongoose.Schema({
	name: String,
	duration: Number,
	images: [{ name: String, size: Number, imageKey: String }],
	artists: [String],
	trackFile: { name: String, trackKey: String, size: Number },
});

const Track = mongoose.model<TrackSchema>('Track', trackSchema, 'tracks');

const newTrack = async (track: Track) => {
	const newTrack = new Track(track);
	await newTrack.save();
};

router.get('/', async (req, res) => {
	// const head = {
	// 	'Content-Type': 'audio/mp4',
	// 	// 'Content-Length': 500,
	// };
	// res.writeHead(200, head);
	const audioStream = s3
		.getObject({
			Bucket: BUCKET_NAME,
			Key: '1600873298014',
		})
		.createReadStream();

	// stream.pipe(res);

	// audioStream.on('error', function (err) {
	// 	// NoSuchKey: The specified key does not exist
	// 	console.error(err);
	// });

	audioStream.pipe(res);

	// res.send('dasdas');

	// const imgs: any = [];
	// const getImages = async () => {
	// 	for (let image of list[0].images as Array<{ imageKey: string }>) {
	// 		const base64 = await s3
	// 			.getObject({
	// 				Bucket: BUCKET_NAME,
	// 				Key: image.imageKey,
	// 			})
	// 			.promise();
	// 		imgs.push(base64.Body!.toString('base64'));
	// 	}

	// 	// (list[0].images as Array<{ imageKey: string }>).forEach(async image => {
	// 	// 	const base64 = await s3
	// 	// 		.getObject({
	// 	// 			Bucket: BUCKET_NAME,
	// 	// 			Key: image.imageKey,
	// 	// 		})
	// 	// 		.promise();
	// 	// 	imgs.push(base64.Body!.toString('base64'));
	// 	// 	// console.log(base64);
	// 	// });
	// };

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
	// await getImages();
	// res.send({ ...list[0], imagesSrc: imgs }).status(200);

	// objectPromise.on('httpDownloadProgress', (progress, data) =>
	// 	console.log(progress, data)
	// );
});

router.get('/i', async (req, res) => {
	const images = await s3
		.getObject({
			Bucket: BUCKET_NAME,
			Key: 'sufna-jannat/images/logo512.png',
		})
		.promise();
	console.log(images);
	res.send(images);
});

router.post(
	'/',
	parseFormData.fields([{ name: 'track', maxCount: 1 }, { name: 'images' }]),
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

		if (!Array.isArray(req.files)) {
			const { images, track } = req.files;
			let imagesInDB: TrackImage[] = [];
			let trackInDB: TrackFile;

			// upload images
			for (let image of images) {
				let imageKey = `${name}/images/${image.originalname}`;
				await s3
					.putObject({
						Bucket: BUCKET_NAME,
						Key: imageKey,
						Body: image.buffer,
					})
					.promise();
				imagesInDB.push({
					name: image.originalname,
					size: image.size,
					imageKey,
				});
			}

			// upload track
			const trackKey = `${name}/${track[0].originalname}`;
			await s3
				.putObject({
					Bucket: BUCKET_NAME,
					Key: trackKey,
					Body: track[0].buffer,
				})
				.promise();

			trackInDB = {
				name: track[0].originalname,
				size: track[0].size,
				trackKey,
			};

			await newTrack({
				artists,
				duration,
				name,
				images: imagesInDB,
				trackFile: trackInDB,
			});
			return res.status(200).send('Done');
		}
		return res.status(400).send('lol');
	}
);

export default router;
