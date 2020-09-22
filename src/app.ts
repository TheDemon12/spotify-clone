import express from 'express';
import tracks from './routes/tracks';
import logger from './middlewares/logger';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';

const app = express();

app.use(express.json());
app.use(helmet());
app.use(morgan('tiny'));
app.use(logger);

app.use('/tracks', tracks);

app.listen(3500, () => console.log('listening at port 3500'));

const connectToDB = async () => {
	try {
		await mongoose.connect('mongodb://localhost/spotify-clone', {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
		console.log('done');
	} catch (ex) {
		console.log(ex);
	}
};

connectToDB();
