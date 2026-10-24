import { redirect } from 'next/navigation';

// A tela inicial do app é o Feed, como no protótipo.
export default function Home() {
  redirect('/feed');
}
