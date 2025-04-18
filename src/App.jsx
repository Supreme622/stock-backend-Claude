
import React, { useState } from 'react';

const sections = ["A", "B", "C"];
const sizes = Array.from({ length: (350 - 17) / 1 + 1 }, (_, i) => 17 + i);

function App() {
  const [selectedSection, setSelectedSection] = useState("A");
  const [selectedSize, setSelectedSize] = useState(17);
  const [stock, setStock] = useState({});

  const handleStockChange = (change) => {
    const key = `${selectedSection}-${selectedSize}`;
    setStock((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + change
    }));
  };

  return (
    <div className="p-4">
      <h1>Stock Management Interface</h1>
      <div>
        <label>Section:</label>
        <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
          {sections.map((section) => <option key={section}>{section}</option>)}
        </select>
      </div>
      <div>
        <label>Size:</label>
        <select value={selectedSize} onChange={(e) => setSelectedSize(Number(e.target.value))}>
          {sizes.map((size) => <option key={size}>{size}</option>)}
        </select>
      </div>
      <div>
        <button onClick={() => handleStockChange(1)}>Add Stock</button>
        <button onClick={() => handleStockChange(-1)}>Subtract Stock</button>
      </div>
      <div>
        <h2>Current Stock</h2>
        <pre>{JSON.stringify(stock, null, 2)}</pre>
      </div>
    </div>
  );
}

export default App;
