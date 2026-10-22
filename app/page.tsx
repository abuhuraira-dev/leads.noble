import {isAuthed} from './session';
import Studio from './studio';
import Login from './login';
export const dynamic='force-dynamic';
export default async function Home(){return (await isAuthed())?<Studio/>:<Login/>}
