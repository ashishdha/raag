// Map integer values to notation systems
// Base: Middle Sa = 0 (MIDI 60, C4)

const svarMap = {
  // Hindustani Sargam notation
  hindustani: {
    '-1': 'N',
    '0': 'S',
    '1': 'r',
    '2': 'R',
    '3': 'g',
    '4': 'G',
    '5': 'M',
    '6': 'm',
    '7': 'P',
    '8': 'd',
    '9': 'D',
    '10': 'n',
    '11': 'N',
    '12': 'S\'',
    '13': 'r\'',
    '14': 'R\''
  },
  
  // Carnatic Sargam notation
  carnatic: {
    '-1': 'Ni',
    '0': 'Sa',
    '1': 'Ri1',
    '2': 'Ri2',
    '3': 'Ga1',
    '4': 'Ga2',
    '5': 'Ma1',
    '6': 'Ma2',
    '7': 'Pa',
    '8': 'Dha1',
    '9': 'Dha2',
    '10': 'Ni1',
    '11': 'Ni2',
    '12': 'Sa\'',
    '13': 'Ri1\'',
    '14': 'Ri2\''
  },
  
  // Western notation (assuming C = Sa)
  western: {
    '-1': 'B3',
    '0': 'C4',
    '1': 'C#4',
    '2': 'D4',
    '3': 'D#4',
    '4': 'E4',
    '5': 'F4',
    '6': 'F#4',
    '7': 'G4',
    '8': 'G#4',
    '9': 'A4',
    '10': 'A#4',
    '11': 'B4',
    '12': 'C5',
    '13': 'C#5',
    '14': 'D5'
  },
  
  // MIDI note values (Middle C = 60)
  midi: {
    '-1': '59',
    '0': '60',
    '1': '61',
    '2': '62',
    '3': '63',
    '4': '64',
    '5': '65',
    '6': '66',
    '7': '67',
    '8': '68',
    '9': '69',
    '10': '70',
    '11': '71',
    '12': '72',
    '13': '73',
    '14': '74'
  }
};

// Convert integer to display format based on notation preference
function convertSvar(value, notation = 'hindustani') {
  const key = value.toString();
  return svarMap[notation][key] || value.toString();
}

// Convert array of integers to display format
function convertSvarArray(arr, notation = 'hindustani') {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.map(val => convertSvar(val, notation)).join(' ');
}

// Get current notation preference from localStorage
function getCurrentNotation() {
  return localStorage.getItem('notation') || 'hindustani';
}

// Set notation preference
function setNotation(notation) {
  localStorage.setItem('notation', notation);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { svarMap, convertSvar, convertSvarArray, getCurrentNotation, setNotation };
}