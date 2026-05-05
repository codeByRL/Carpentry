import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const email = 'nachman@test.com';
const newPassword = '123456';

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB:', mongoose.connection.name);

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await mongoose.connection.collection('users').updateOne(
      { email },
      { $set: { password: newHashedPassword } }
    );

    console.log('Update result:', result);

    // בדיקה
    const user = await mongoose.connection.collection('users').findOne({ email });
    const isMatch = await bcrypt.compare(newPassword, user.password);
    console.log('Password match:', isMatch ? '✅ YES' : '❌ NO');
    console.log('Password starts with:', user.password?.slice(0, 20));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

run();