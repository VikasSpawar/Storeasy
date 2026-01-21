import AuthForm from '../../components/AuthForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">Storeasy</h1>
        <div className="h-1 w-20 bg-blue-600 mx-auto mt-4 rounded-full"></div>
      </div>
      <AuthForm />
    </div>
  );
}