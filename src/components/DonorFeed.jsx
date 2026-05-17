import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, getDocs, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const DonorFeed = ({ onLogout, currentUserEmail }) => {
  const [needs, setNeeds] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedNeed, setSelectedNeed] = useState(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [showWillingModal, setShowWillingModal] = useState(false);
  const [myDonations, setMyDonations] = useState([]);
  const [publicThankYous, setPublicThankYous] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donorDetails, setDonorDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    donationOption: '',
  });

  const categories = [
    { value: 'all', label: 'All Categories', icon: '📋' },
    { value: 'grocery', label: '🍚 Grocery & Food', icon: '🍚' },
    { value: 'stationery', label: '📚 Stationery & Books', icon: '📚' },
    { value: 'clothes', label: '👕 Clothes', icon: '👕' },
    { value: 'sanitary', label: '🩸 Sanitary Pads', icon: '🩸' },
    { value: 'medicines', label: '💊 Medicines', icon: '💊' },
    { value: 'hygiene', label: '🧼 Hygiene Products', icon: '🧼' },
    { value: 'toys', label: '🧸 Toys', icon: '🧸' },
    { value: 'other', label: '📦 Other', icon: '📦' },
  ];

  // Load ALL public thank you messages for EVERY donor to see
  useEffect(() => {
    console.log('Loading public thank you messages...');
    
    // Simple query - get all completed donations that have a publicThankYou message
    const q = query(
      collection(db, 'donations'), 
      where('status', '==', 'completed'),
      where('publicThankYou', '!=', null)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const thankYous = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by most recent first
      thankYous.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      console.log('Public thank you messages loaded:', thankYous.length);
      console.log('First thank you:', thankYous[0]);
      setPublicThankYous(thankYous);
    }, (error) => {
      console.error('Error loading thank yous:', error);
    });
    
    return () => unsubscribe();
  }, []);

  // Load needs
  useEffect(() => {
    loadNeeds();
  }, []);

  // Load my own donations
  useEffect(() => {
    const loadMyDonations = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      const q = query(
        collection(db, 'donations'), 
        where('donorDetails.email', '==', user.email)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const donations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setMyDonations(donations);
      });
      
      return () => unsubscribe();
    };
    
    if (auth.currentUser) {
      loadMyDonations();
    }
  }, []);

  const loadNeeds = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'needs'));
      let allNeeds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const donationsSnapshot = await getDocs(collection(db, 'donations'));
      const fulfilledNeedIds = new Set();
      
      donationsSnapshot.docs.forEach(doc => {
        const donation = doc.data();
        if (donation.needId) {
          fulfilledNeedIds.add(donation.needId);
        }
      });
      
      const availableNeeds = allNeeds.filter(need => !fulfilledNeedIds.has(need.id));
      availableNeeds.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setNeeds(availableNeeds);
    } catch (error) {
      console.error('Error loading needs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNeeds = filterCategory === 'all' 
    ? needs 
    : needs.filter(need => need.category === filterCategory);

  const handleDonateClick = (need) => {
    setSelectedNeed(need);
    setDonorDetails({ 
      name: '', 
      email: currentUserEmail || '', 
      phone: '', 
      address: '', 
      donationOption: '' 
    });
    setShowDonateModal(true);
  };

  const handleConfirmDonation = async () => {
    if (!selectedNeed) return;
    if (!donorDetails.name || !donorDetails.phone || !donorDetails.donationOption) {
      alert('Please fill in your name, phone number, and select donation option');
      return;
    }

    const donationRecord = {
      ngoId: selectedNeed.ngoId,
      ngoName: selectedNeed.ngoName,
      needId: selectedNeed.id,
      itemName: selectedNeed.itemName,
      quantity: selectedNeed.quantity,
      donationOption: donorDetails.donationOption,
      donorDetails: {
        name: donorDetails.name,
        email: currentUserEmail || donorDetails.email || 'Not provided',
        phone: donorDetails.phone,
        address: donorDetails.address || 'Not provided',
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    try {
      await addDoc(collection(db, 'donations'), donationRecord);
      alert(`✅ Thank you ${donorDetails.name} for donating ${selectedNeed.itemName} to ${selectedNeed.ngoName}!\n\nThe NGO will contact you soon.`);
      setShowDonateModal(false);
      setSelectedNeed(null);
      setDonorDetails({ name: '', email: '', phone: '', address: '', donationOption: '' });
      loadNeeds();
    } catch (error) {
      console.error('Error saving donation:', error);
      alert('Failed to record donation. Please try again.');
    }
  };

  const handleWillingToDonate = () => {
    setDonorDetails({ 
      name: '', 
      email: currentUserEmail || '', 
      phone: '', 
      address: '', 
      donationOption: '', 
      itemName: '', 
      itemCategory: '', 
      itemDescription: '' 
    });
    setShowWillingModal(true);
  };

  const handleWillingSubmit = async (e) => {
    e.preventDefault();
    if (!donorDetails.name || !donorDetails.phone || !donorDetails.itemName || !donorDetails.donationOption) {
      alert('Please fill all required fields');
      return;
    }

    const donationRecord = {
      ngoName: 'Any NGO (Open Offer)',
      itemName: donorDetails.itemName,
      itemCategory: donorDetails.itemCategory,
      itemDescription: donorDetails.itemDescription,
      donationOption: donorDetails.donationOption,
      donorDetails: {
        name: donorDetails.name,
        email: currentUserEmail || donorDetails.email || 'Not provided',
        phone: donorDetails.phone,
        address: donorDetails.address || 'Not provided',
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    
    try {
      await addDoc(collection(db, 'donations'), donationRecord);
      alert(`✅ Thank you ${donorDetails.name} for your donation offer!\n\nNGOs will review your offer and contact you.`);
      setShowWillingModal(false);
      setDonorDetails({
        name: '',
        email: '',
        phone: '',
        address: '',
        itemName: '',
        itemCategory: '',
        itemDescription: '',
        donationOption: '',
      });
    } catch (error) {
      console.error('Error saving donation offer:', error);
      alert('Failed to submit offer. Please try again.');
    }
  };

  const urgencyColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">🤝 Helping Hands</h1>
            <p className="text-gray-500">Donor Dashboard – Help NGOs get what they need</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleWillingToDonate}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
            >
              🙏 I Want to Donate
            </button>
            <button
              onClick={onLogout}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* PUBLIC THANK YOU MESSAGES - Shows donor names to ALL donors */}
        {publicThankYous.length > 0 ? (
          <div className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🎉</span> Recent Donations
            </h2>
            <p className="text-sm text-gray-500 mb-4">See who's making a difference! Join them by donating below.</p>
            <div className="space-y-3">
              {publicThankYous.map((thankYou) => (
                <div key={thankYou.id} className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-400">
                  <p className="text-gray-800">
                    <span className="font-bold text-green-600">{thankYou.donorDetails?.name || 'Someone'}</span>
                    {' '}donated <span className="font-semibold">{thankYou.itemName}</span> to{' '}
                    <span className="font-semibold text-orange-600">{thankYou.ngoName}</span>
                  </p>
                  <p className="text-sm text-gray-700 mt-2 italic bg-green-50 p-2 rounded">
                    "{thankYou.publicThankYou}"
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(thankYou.updatedAt || thankYou.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-green-600 mt-3 text-center font-medium">
              ✨ Your donation could be featured here next! ✨
            </p>
          </div>
        ) : (
          <div className="mb-8 bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-gray-500">No donations yet. Be the first to donate and inspire others! 🎁</p>
          </div>
        )}

        {/* My Donations Section - Only for this donor */}
        {myDonations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📦 My Donations</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myDonations.map((donation) => (
                <div 
                  key={donation.id} 
                  className={`rounded-2xl shadow-md p-5 transition-all duration-300 ${
                    donation.status === 'completed' 
                      ? 'bg-green-100 border-2 border-green-400' 
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {donation.status === 'completed' ? (
                      <span className="text-3xl">✅</span>
                    ) : (
                      <span className="text-3xl">🎁</span>
                    )}
                    <div>
                      <p className="font-bold text-gray-800">{donation.itemName}</p>
                      <p className="text-sm text-gray-600">to {donation.ngoName}</p>
                    </div>
                  </div>
                  
                  {donation.status === 'completed' ? (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg">
                      <p className="text-green-700 font-medium">✨ Completed! ✨</p>
                      {donation.publicThankYou && (
                        <p className="text-sm text-green-600 mt-1">NGO said: "{donation.publicThankYou}"</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-yellow-700 text-sm">⏳ Status: Pending</p>
                      <p className="text-xs text-gray-500 mt-1">The NGO will contact you soon.</p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-400 mt-3">
                    Donated on: {new Date(donation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8">
          <p className="text-sm font-medium text-gray-700 mb-3">Filter by category:</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setFilterCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  filterCategory === cat.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Needs List */}
        {filteredNeeds.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <p className="text-gray-500 text-lg">No active needs at the moment.</p>
            <p className="text-gray-400 text-sm mt-2">All requests have been fulfilled! Check back later or click "I Want to Donate" to offer items.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredNeeds.map((need) => (
              <div key={need.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="p-4 text-white bg-orange-500">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl">{need.categoryLabel?.split(' ')[0] || '📦'}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${urgencyColors[need.urgency]}`}>
                      {need.urgency?.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-800">{need.ngoName}</h3>
                  <p className="text-orange-600 text-sm mt-1">{need.categoryLabel}</p>
                  <p className="text-gray-800 font-semibold mt-3">{need.itemName}</p>
                  <p className="text-gray-500 text-sm">Quantity: {need.quantity}</p>
                  {need.description && (
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">{need.description}</p>
                  )}
                  <button
                    onClick={() => handleDonateClick(need)}
                    className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold transition"
                  >
                    🙏 Donate This
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Donation Modal */}
        {showDonateModal && selectedNeed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Donate to {selectedNeed.ngoName}</h2>
              <p className="text-gray-600 mb-4"><strong>Item:</strong> {selectedNeed.itemName}</p>
              <p className="text-gray-600 mb-4"><strong>Quantity needed:</strong> {selectedNeed.quantity}</p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Full Name *</label>
                  <input type="text" value={donorDetails.name} onChange={(e) => setDonorDetails({...donorDetails, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input type="tel" value={donorDetails.phone} onChange={(e) => setDonorDetails({...donorDetails, phone: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={donorDetails.email} onChange={(e) => setDonorDetails({...donorDetails, email: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" disabled />
                  <p className="text-xs text-gray-400">Your email is auto-filled from your account</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Address (for pickup)</label>
                  <textarea value={donorDetails.address} onChange={(e) => setDonorDetails({...donorDetails, address: e.target.value})} rows="2" className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Full address for pickup" />
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to donate? *</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-orange-50">
                    <input type="radio" name="donationOption" value="dropoff" onChange={(e) => setDonorDetails({...donorDetails, donationOption: e.target.value})} className="w-4 h-4 text-orange-500" />
                    <span>🏢 I will drop off at NGO</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-orange-50">
                    <input type="radio" name="donationOption" value="pickup" onChange={(e) => setDonorDetails({...donorDetails, donationOption: e.target.value})} className="w-4 h-4 text-orange-500" />
                    <span>🚚 Schedule a pickup from my address</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleConfirmDonation} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold transition">Confirm Donation</button>
                <button onClick={() => { setShowDonateModal(false); setSelectedNeed(null); }} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg font-semibold transition">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Willing to Donate Modal */}
        {showWillingModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🙏 I Want to Donate</h2>
              <p className="text-gray-500 mb-6">Fill your details and the items you wish to donate. NGOs will see your offer.</p>
              
              <form onSubmit={handleWillingSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label><input type="text" value={donorDetails.name} onChange={(e) => setDonorDetails({...donorDetails, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" value={donorDetails.email} onChange={(e) => setDonorDetails({...donorDetails, email: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" disabled /></div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label><input type="tel" value={donorDetails.phone} onChange={(e) => setDonorDetails({...donorDetails, phone: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Category *</label><select value={donorDetails.itemCategory} onChange={(e) => setDonorDetails({...donorDetails, itemCategory: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required><option value="">Select</option>{categories.filter(c => c.value !== 'all').map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}</select></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label><input type="text" value={donorDetails.itemName} onChange={(e) => setDonorDetails({...donorDetails, itemName: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg" required /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={donorDetails.itemDescription} onChange={(e) => setDonorDetails({...donorDetails, itemDescription: e.target.value})} rows="2" className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Address (for pickup)</label><textarea value={donorDetails.address} onChange={(e) => setDonorDetails({...donorDetails, address: e.target.value})} rows="2" className="w-full px-4 py-2 border border-gray-300 rounded-lg" /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How would you like to donate? *</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-orange-50"><input type="radio" name="willingDonationOption" value="dropoff" onChange={(e) => setDonorDetails({...donorDetails, donationOption: e.target.value})} className="w-4 h-4 text-orange-500" /><span>🏢 I will drop off at NGO</span></label>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-orange-50"><input type="radio" name="willingDonationOption" value="pickup" onChange={(e) => setDonorDetails({...donorDetails, donationOption: e.target.value})} className="w-4 h-4 text-orange-500" /><span>🚚 Schedule a pickup from my address</span></label>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-semibold transition">Submit Donation Offer</button>
                  <button type="button" onClick={() => setShowWillingModal(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg font-semibold transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonorFeed;