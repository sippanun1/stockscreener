import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[600px] px-4">
      {/* 404 Large Text */}
      <div className="text-[120px] font-bold text-[#10B981] leading-none mb-4">
        404
      </div>
      
      {/* Error Message */}
      <h1 className="text-3xl font-bold text-[#F8FAFC] mb-3">
        Page Not Found
      </h1>
      
      <p className="text-[#7588A3] text-center max-w-md mb-8">
        The stock symbol you're looking for doesn't exist in our database,
        or the page you requested could not be found.
      </p>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors font-medium"
        >
          Back to Screener
        </button>
        
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-[#1E2530] text-[#F8FAFC] rounded-lg hover:bg-[#354052] transition-colors font-medium"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
