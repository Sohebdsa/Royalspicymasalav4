import React from 'react';
import CatererSellComponent from '../../components/caterers/CatererSellComponent';

const CatererSellPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Sell Products to Caterer
          </h1>
          <CatererSellComponent />
        </div>
  );
};

export default CatererSellPage;