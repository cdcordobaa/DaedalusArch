import axios from 'axios';
export async function get(url: string): Promise<unknown> {
  return (await axios.get(url)).data;
}
