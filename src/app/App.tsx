import { Route, Routes } from 'react-router-dom';
import Layout from './layouts/Layout';
import HomePage from '@/pages/HomePage';
import RegisterPage from '@/pages/RegisterPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
