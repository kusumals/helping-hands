import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';

const NGOS = [
  { id: 1, name: 'Sri Sai Sneha Foundation' },
  { id: 2, name: 'Sanpattu Foundation' },
  { id: 3, name: 'Prasanna Jyothi' },
];

const CATEGORIES = [
  { value: 'grocery', label: '🍚 Grocery & Food' },
  { value: 'stationery', label: '📚 Stationery & Books' },
  { value: 'clothes', label: '👕 Clothes' },
  { value: 'sanitary', label: '🩸 Sanitary Pads' },
  { value: 'medicines', label: '💊 Medicines' },
  { value: 'hygiene', label: '🧼 Hygiene Products' },
  { value: 'toys', label: '🧸 Toys' },
  { value: 'furniture', label: '🪑 Furniture' },
  { value: 'electronics', label: '📱 Electronics' },
  { value: 'other', label: '📦 Other' },
];

const NGODashboard = ({ onLogout }) => {
  const [selectedNGO, setSelectedNGO] = useState(null);
  const [category, setCategory] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [showPostForm, setShowPostForm] = useState(false);
  const [postedNeeds, setPostedNeeds] = useState([]);
  const [donationsForNGO, setDonationsForNGO] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedNGO) {
      loadNeedsForNGO(selectedNGO.id);
      loadDonationsForNGO(selectedNGO.name);
    }
  }, [selectedNGO]);

  const loadNeedsForNGO = async (ngoId) => {
    try {
      const q = query(collection(db, 'needs'), where('ngoId', '==', ngoId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const needs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPostedNeeds(needs);
    } catch (error) {
      console.error('Error loading needs:', error);
    }
  };

  const loadDonationsForNGO = async (ngoName) => {
    try {
      const q = query(collection(db, 'donations'), where('ngoName', '==', ngoName), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const donations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDonationsForNGO(donations);
    } catch (error) {
      console.error('Error loading donations:', error);
    }
  };

  const handleSelectNGO = (ngo) => {
    setSelectedNGO(ngo);
    setShowPostForm(true);
  };

  const handlePostNeed = async (e) => {
    e.preventDefault();
    if (!category || !itemName || !quantity) return;
    
    const newNeed = {
      ngoId: selectedNGO.id,
      ngoName: selectedNGO.name,
      category: category,
      categoryLabel: CATEGORIES.find(c => c.value === category)?.label,
      itemName: itemName,
      quantity: quantity,
      description: description,
      urgency: urgency,
      createdAt: new Date().toISOString(),
    };
    
    try {
      await addDoc(collection(db, 'needs'), newNeed);
      alert('Need posted successfully!');
      await loadNeedsForNGO(selectedNGO.id);
      setCategory('');
      setItemName('');
      setQuantity('');
      setDescription('');
      setUrgency('medium');
    } catch (error) {
      alert('Failed to post. Please try again.');
    }
  };

  const markAsCompleted = async (donationId, donorName, itemName) => {
    try {
      await updateDoc(doc(db, 'donations', donationId), { 
        status: 'completed', 
        updatedAt: new Date().toISOString() 
      });
      alert('Donation marked as completed!');
      await loadDonationsForNGO(selectedNGO.name);
    } catch (error) {
      alert('Failed to update status.');
    }
  };

  const postThankYou = async (donationId, message) => {
    if (!message.trim()) {
      alert('Please write a thank you message');
      return;
    }
    try {
      await updateDoc(doc(db, 'donations', donationId), { 
        publicThankYou: message,
        updatedAt: new Date().toISOString()
      });
      alert('✅ Thank you message posted! All donors can now see it.');
      await loadDonationsForNGO(selectedNGO.name);
    } catch (error) {
      alert('Failed to post thank you message.');
    }
  };

  if (!selectedNGO && !showPostForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">🤝 NGO Dashboard</h1>
            <button onClick={onLogout} className="bg-gray-500 text-white px-4 py-2 rounded-lg">Logout</button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {NGOS.map((ngo) => (
              <div key={ngo.id} onClick={() => handleSelectNGO(ngo)} className="bg-white rounded-2xl shadow-lg p-6 cursor-pointer hover:shadow-xl">
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">🏢</div>
                  <h3 className="text-xl font-semibold">{ngo.name}</h3>
                  <p className="text-orange-500 text-sm mt-2">Click to post needs →</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setSelectedNGO(null); setShowPostForm(false); }} className="text-orange-500">← Back</button>
          <button onClick={onLogout} className="bg-gray-500 text-white px-4 py-2 rounded-lg">Logout</button>
        </div>

        {/* Post Need Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-center mb-6">{selectedNGO.name}</h2>
          <form onSubmit={handlePostNeed} className="space-y-4">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 border rounded" required>
              <option value="">Select Category</option>
              {CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
            </select>
            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item Name" className="w-full p-2 border rounded" required />
            <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" className="w-full p-2 border rounded" required />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows="2" className="w-full p-2 border rounded" />
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full p-2 border rounded">
              <option value="low">Low Urgency</option>
              <option value="medium">Medium Urgency</option>
              <option value="high">High Urgency</option>
              <option value="critical">Critical Urgency</option>
            </select>
            <button type="submit" className="w-full bg-orange-500 text-white py-2 rounded-lg">Post Need</button>
          </form>
        </div>

        {/* Donations Received */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="text-xl font-bold mb-4">🎁 Donations Received</h3>
          {donationsForNGO.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No donations yet</p>
          ) : (
            <div className="space-y-4">
              {donationsForNGO.map((donation) => (
                <div key={donation.id} className={`p-4 rounded-lg border-l-4 ${donation.status === 'completed' ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                  <p><strong>Donor:</strong> {donation.donorDetails?.name || 'Anonymous'}</p>
                  <p><strong>Item:</strong> {donation.itemName}</p>
                  <p><strong>Phone:</strong> {donation.donorDetails?.phone || 'Not provided'}</p>
                  <p><strong>Address:</strong> {donation.donorDetails?.address || 'Not provided'}</p>
                  <p><strong>Delivery:</strong> {donation.donationOption === 'dropoff' ? 'Drop off at NGO' : 'Pickup required'}</p>
                  <p><strong>Status:</strong> {donation.status === 'completed' ? '✅ Completed' : '⏳ Pending'}</p>
                  
                  {donation.status !== 'completed' && (
                    <button
                      onClick={() => markAsCompleted(donation.id, donation.donorDetails?.name, donation.itemName)}
                      className="mt-2 bg-green-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Mark Completed
                    </button>
                  )}
                  
                  {donation.status === 'completed' && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <label className="block text-sm font-medium mb-1">Public Thank You Message (visible to ALL donors)</label>
                      <textarea
                        id={`msg_${donation.id}`}
                        defaultValue={donation.publicThankYou || `Thank you ${donation.donorDetails?.name} for donating ${donation.itemName}! 🎉`}
                        rows="2"
                        className="w-full p-2 border border-green-300 rounded"
                      />
                      <button
                        onClick={() => {
                          const msg = document.getElementById(`msg_${donation.id}`).value;
                          postThankYou(donation.id, msg);
                        }}
                        className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm"
                      >
                        📢 Post Public Thank You
                      </button>
                      {donation.publicThankYou && (
                        <p className="text-sm text-green-600 mt-2">Current message: "{donation.publicThankYou}"</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NGODashboard;