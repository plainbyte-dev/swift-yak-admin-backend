import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not set in the environment');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri);

  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  return conn;
}
