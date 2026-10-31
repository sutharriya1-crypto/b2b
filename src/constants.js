// Shared reference data. `tpa` = rough tonnes of residue per acre, used only to
// pre-fill an estimate; farmers can override the tonnage when they post land.
const CROPS = {
  paddy:     { label: 'Paddy (rice) straw', tpa: 2.5 },
  wheat:     { label: 'Wheat straw',        tpa: 1.6 },
  sugarcane: { label: 'Sugarcane trash',    tpa: 3.0 },
  cotton:    { label: 'Cotton stalks',      tpa: 1.2 },
  maize:     { label: 'Maize stalks',       tpa: 2.0 },
  mustard:   { label: 'Mustard stalks',     tpa: 1.2 },
  other:     { label: 'Other residue',      tpa: 1.5 },
};

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

module.exports = { CROPS, STATES };
