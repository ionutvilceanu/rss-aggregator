import Head from 'next/head';
import SubscriptionForm from '../components/SubscriptionForm';

const Subscribe = () => {
  return (
    <div>
      <Head>
        <title>Abonare RSS</title>
        <meta name="description" content="Gestionați abonamentele la fluxurile RSS" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto p-4">
        <h1 className="text-4xl font-bold mb-4">Abonare la Fluxuri RSS</h1>
        <SubscriptionForm />
      </main>
    </div>
  );
};

export default Subscribe; 