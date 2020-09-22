import { Router, Request } from 'express';
import Joi from 'joi';
import mongoose from 'mongoose';
import multer from 'multer';
import aws from 'aws-sdk';
import multerS3 from 'multer-s3';

const ID = '';
const SECRET = '';
const BUCKET_NAME = '';

const s3 = new aws.S3({
	accessKeyId: ID,
	secretAccessKey: SECRET,
});

const router = Router();

// const list = [
// 	{
// 		name: '',
// 		id: '',
// 		duration: '',
// 		images: [
// 			{
// 				height: 640,
// 				url:
// 					'https://i.scdn.co/image/966vade7a8c43b72faa53822b74a899c675aaafee',
// 				width: 640,
// 			},
// 		],

// 		artists: [
// 			{
// 				name: '',
// 				id: '',
// 			},
// 		],
// 	},
// ];

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
	(
		req: Request<
			{},
			{},
			{ name: string; duration: number; images: File[]; artists: string[] }
		>,
		res
	) => {
		// const validateSchema = {
		// 	name: Joi.string().min(5).max(25).required(),
		// };

		// const { error } = Joi.object(validateSchema).validate(req.body);
		// if (error) return res.status(400).send(error.details[0].message);
		// uploadFile(req.files.images);
		// console.log(req.files, req.body);
		// console.log(req.files);

		let images: Array<{ name: string; size: number; imageKey: string }> = [];

		for (let key in req.files) {
			const file = req.files[key];
			images.push({
				name: file.originalname,
				size: file.size,
				imageKey: file.key,
			});
		}
		list.push({ ...req.body, images });
		res.status(200).send('Done');
	}
);

export default router;
