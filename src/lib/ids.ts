import 'react-native-get-random-values';
import { nanoid } from 'nanoid';

export function newId(): string {
  return nanoid(16);
}
