import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center text-white px-4">
      <div className="text-center">
        <h1 className="mb-4 text-8xl font-display font-bold bg-gradient-to-r from-red-400 to-purple-500 bg-clip-text text-transparent">404</h1>
        <p className="mb-8 text-2xl text-gray-300">Oops! This page doesn't exist</p>
        <Link 
          to="/" 
          className="inline-block px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-full font-semibold transition-all duration-300 hover:scale-105"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
