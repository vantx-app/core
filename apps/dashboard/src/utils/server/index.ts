import { cookies } from 'next/headers';
import { ROLES } from '../enums';


export async function getUserRole(): Promise<ROLES> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (!token) return ROLES.DRIVER;

    const payloadBase64 = token.split('.')[1];
    const payloadBuffer = Buffer.from(payloadBase64, 'base64');
    const payload = JSON.parse(payloadBuffer.toString('utf-8'));

    return payload.role ?? ROLES.DRIVER;
  } catch (error) {
    console.error('Error decodificando JWT en cliente:', error);
    return ROLES.DRIVER;
  }
}