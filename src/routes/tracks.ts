import { Router, Request } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import aws from 'aws-sdk';
import config from 'config';

const ID: string = config.get('awsAccessKeyId');
const SECRET: string = config.get('awsSecretAccessKey');
const BUCKET_NAME: string = config.get('awsBucketName');
const REGION: string = config.get('awsRegion');

const s3 = new aws.S3({
	accessKeyId: ID,
	secretAccessKey: SECRET,
	region: REGION,
});

const router = Router();
let parseFormData = multer();

interface TrackImage {
	name: String;
	size: Number;
	imageKey: String;
	src?: String;
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

router.get(
	'/',
	async (
		req: Request<{}, {}, {}, { images: 'none' | 'single' | 'all' }>,
		res
	) => {
		const imageQuery = req.query.images;
		const tracks = await Track.find();

		if (tracks) {
			let response: Track[] = [];

			if (imageQuery && imageQuery !== 'none') {
				if (imageQuery === 'single') {
					for (let track of tracks) {
						const res = track.toJSON();
						const image = res.images[0];

						const imageBuffer = await s3
							.getObject({
								Bucket: BUCKET_NAME,
								Key: image.imageKey.toString(),
							})
							.promise();

						image.src = imageBuffer.Body!.toString('base64');
						response.push(res);
					}
				}
				if (imageQuery === 'all') {
					for (let track of tracks) {
						const res = track.toJSON();

						for (let image of res.images) {
							const imageBuffer = await s3
								.getObject({
									Bucket: BUCKET_NAME,
									Key: image.imageKey.toString(),
								})
								.promise();

							image.src = imageBuffer.Body!.toString('base64');
						}
						response.push(res);
					}
				}
			}

			res.send(response);
		}
	}
);

router.get(
	'/:id',
	async (
		req: Request<{ id: string }, {}, {}, { images: 'none' | 'single' | 'all' }>,
		res
	) => {
		const trackId = req.params.id;
		const imageQuery = req.query.images;

		const track = await Track.findOne({
			_id: trackId,
		});

		if (track) {
			const response: TrackSchema = track.toObject();

			if (imageQuery && imageQuery !== 'none') {
				if (imageQuery === 'single') {
					const image = response.images[0];

					const imageBuffer = await s3
						.getObject({
							Bucket: BUCKET_NAME,
							Key: image.imageKey.toString(),
						})
						.promise();

					image.src = imageBuffer.Body!.toString('base64');
				} else if (imageQuery === 'all') {
					for (let image of response.images) {
						const imageBuffer = await s3
							.getObject({
								Bucket: BUCKET_NAME,
								Key: image.imageKey.toString(),
							})
							.promise();

						image.src = imageBuffer.Body!.toString('base64');
					}
				}
			}

			res.send(response).status(200);
		}
	}
);

router.get('/:id/play', async (req: Request<{ id: string }>, res) => {
	const trackId = req.params.id;

	const data = await Track.findOne({
		_id: trackId,
	});

	const track: Track = data!.toJSON();

	const url = await s3.getSignedUrlPromise('getObject', {
		Bucket: BUCKET_NAME,
		Key: track.trackFile.trackKey,
		Expires: 360,
	});

	res.send(url);
});

router.post(
	'/',
	parseFormData.fields([{ name: 'track' }, { name: 'images' }]),
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

			for (let trackFile of track) {
				const trackKey = `${name}/tracks/${trackFile.originalname}`;
				if (trackFile.mimetype.includes('mp2t')) {
					await s3
						.putObject({
							Bucket: BUCKET_NAME,
							Key: trackKey,
							Body: trackFile.buffer,
							ACL: 'public-read',
						})
						.promise();
				} else if (trackFile.mimetype.includes('mpegurl')) {
					await s3
						.putObject({
							Bucket: BUCKET_NAME,
							Key: trackKey,
							Body: trackFile.buffer,
						})
						.promise();

					trackInDB = {
						name: trackFile.originalname,
						size: trackFile.size,
						trackKey,
					};
				}
			}
			await newTrack({
				artists,
				duration,
				name,
				images: imagesInDB,
				trackFile: trackInDB!,
			});
			return res.status(200).send('Done');
		}
		return res.status(400).send('lol');
	}
);

export default router;
