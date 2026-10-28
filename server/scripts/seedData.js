// Reference data and clearly flagged demonstration listings.
const f = (key, label, placeholder = '', required = false) => ({ key, label, placeholder, required });

export const CATEGORIES = [
  { slug: 'laminates', name: 'Laminates and decorative surfaces', pattern: 'wood', colors: ['#B9895B', '#9C6E45'], subcategories: ['Decorative laminates', 'Compact laminates', 'Acrylic laminates', 'PVC laminates'],
    specFields: [f('sheetSize', 'Sheet size', '8 ft x 4 ft', true), f('thickness', 'Thickness', '1.0 mm', true), f('finish', 'Finish', 'Matte, gloss, suede'), f('colour', 'Colour / design'), f('designCode', 'Design code')] },
  { slug: 'veneers', name: 'Veneers and acrylic sheets', pattern: 'plain', colors: ['#D8C9AE', '#C2AF8D'], subcategories: ['Veneers', 'Acrylic sheets', 'Veneer plywood'],
    specFields: [f('sheetSize', 'Sheet size', '8 ft x 4 ft', true), f('thickness', 'Thickness', '4 mm', true), f('species', 'Wood species / material', 'Teak'), f('finish', 'Finish')] },
  { slug: 'louvers', name: 'Louvers and wall panels', pattern: 'louver', colors: ['#4A5A43', '#2C3A2A'], subcategories: ['Wall panels', 'Louvers', 'Fluted panels'],
    specFields: [f('length', 'Length', '2400 mm', true), f('width', 'Width', '120 mm'), f('thickness', 'Thickness'), f('finish', 'Finish')] },
  { slug: 'tiles', name: 'Tiles and flooring', pattern: 'tile', colors: ['#CFCBC2', '#A8A398'], subcategories: ['Vitrified tiles', 'Ceramic tiles', 'Wooden flooring', 'Vinyl flooring'],
    specFields: [f('tileSize', 'Tile size', '600 x 600 mm', true), f('tilesPerBox', 'Tiles per box', '4', true), f('coveragePerBox', 'Coverage per box', '1.44 sq m'), f('totalCoverage', 'Total coverage', '123.8 sq m'), f('finish', 'Finish'), f('batchShade', 'Batch / shade', 'Single batch')] },
  { slug: 'stone', name: 'Marble, granite and natural stone', pattern: 'stone', colors: ['#E9E6E0', '#7C7F82'], subcategories: ['Granite', 'Marble', 'Quartz', 'Sandstone'],
    specFields: [f('material', 'Stone type', 'Black granite', true), f('slabs', 'Number of slabs'), f('thickness', 'Thickness', '18 mm'), f('finish', 'Finish', 'Polished'), f('approxArea', 'Approx. area', '180 sq ft')] },
  { slug: 'doors', name: 'Doors and windows', pattern: 'wood', colors: ['#6E4B31', '#573822'], subcategories: ['Interior doors', 'Main doors', 'Windows', 'Frames'],
    specFields: [f('size', 'Size', '7 ft x 3 ft', true), f('material', 'Material'), f('frame', 'Frame included'), f('finish', 'Finish')] },
  { slug: 'sanitaryware', name: 'Sanitaryware and bathroom fittings', pattern: 'plain', colors: ['#F1F0EC', '#D9D7D0'], subcategories: ['Toilets', 'Wash basins', 'Faucets', 'Showers'],
    specFields: [f('type', 'Type', 'Wall-hung'), f('colour', 'Colour'), f('includes', 'Included parts', 'Seat cover, cistern')] },
  { slug: 'plumbing-electrical', name: 'Plumbing and electrical materials', pattern: 'plain', colors: ['#8D9296', '#6C7175'], subcategories: ['Pipes and fittings', 'Wires and cables', 'Switches'],
    specFields: [f('specification', 'Specification', 'CPVC SDR 11'), f('size', 'Size'), f('rating', 'Rating')] },
  { slug: 'lighting', name: 'Lighting and fixtures', pattern: 'plain', colors: ['#E7D9A8', '#C8B473'], subcategories: ['Downlights', 'Profile lights', 'Decorative lights'],
    specFields: [f('wattage', 'Wattage', '12 W'), f('colourTemp', 'Colour temperature', '3000 K'), f('fitting', 'Fitting type')] },
  { slug: 'furniture-hardware', name: 'Furniture and hardware', pattern: 'plain', colors: ['#7B7F83', '#55595C'], subcategories: ['Hinges and channels', 'Handles', 'Furniture'],
    specFields: [f('material', 'Material'), f('dimensions', 'Dimensions'), f('finish', 'Finish')] },
  { slug: 'cladding-decking', name: 'Exterior cladding and decking', pattern: 'wood', colors: ['#8A6A47', '#6A4F34'], subcategories: ['Decking', 'Cladding', 'Pergola sections'],
    specFields: [f('boardSize', 'Board size', '140 x 22 mm'), f('length', 'Length'), f('material', 'Material'), f('finish', 'Finish')] },
  { slug: 'other', name: 'Other interior and exterior materials', pattern: 'plain', colors: ['#BDB6A6', '#9D9684'], subcategories: [],
    specFields: [f('dimensions', 'Dimensions'), f('material', 'Material'), f('finish', 'Finish')] },
];

// Approximate locality centres as [longitude, latitude]. Rough points for "near" sorting only,
// accurate to a kilometre or two. Admins can correct them on the Localities screen.
export const LOCALITIES = {
  Bengaluru: {
    Jayanagar: [77.5938, 12.9250], Basavanagudi: [77.5737, 12.9416], Peenya: [77.5190, 13.0285], Yeshwanthpur: [77.5400, 13.0237],
    Whitefield: [77.7500, 12.9698], 'Electronic City': [77.6600, 12.8452], 'HSR Layout': [77.6446, 12.9116], Bommanahalli: [77.6205, 12.9030],
    Rajajinagar: [77.5530, 12.9910], Koramangala: [77.6245, 12.9352], Indiranagar: [77.6408, 12.9784], 'JP Nagar': [77.5857, 12.9063],
    Banashankari: [77.5468, 12.9255], Hebbal: [77.5970, 13.0358], Yelahanka: [77.5963, 13.1007], Marathahalli: [77.7011, 12.9569],
    'Mysore Road': [77.5300, 12.9500], 'Tumkur Road': [77.5100, 13.0400], 'KR Puram': [77.6950, 13.0070], Malleshwaram: [77.5700, 13.0035],
  },
};

// SAMPLE sellers and listings. Not real businesses, stock or prices.
// Sample sellers never publish a phone number, so no real person can be called by mistake.
export const SAMPLE_SELLERS = [
  { key: 'a', name: 'Sample Laminates Co.', type: 'Dealer', id: true, biz: true },
  { key: 'b', name: 'Sample Tile Traders', type: 'Distributor', id: true, biz: false },
  { key: 'c', name: 'Sample Stone Yard', type: 'Manufacturer', id: true, biz: true },
  { key: 'd', name: 'Sample Interiors', type: 'Contractor', id: true, biz: false },
  { key: 'e', name: 'Sample Bath Studio', type: 'Retailer', id: true, biz: true },
  { key: 'f', name: 'Sample Outdoors', type: 'Contractor', id: false, biz: false },
  { key: 'g', name: 'Sample Plywood Mart', type: 'Dealer', id: true, biz: true },
  { key: 'h', name: 'Sample Salvage', type: 'Individual', id: true, biz: false },
];

export const SAMPLE_LISTINGS = [
  { seller: 'a', daysAgo: 7, title: '1.0 mm woodgrain laminate sheets, walnut finish', cat: 'laminates', subcategory: 'Decorative laminates', brand: 'Sample Brand A', model: 'WG-204', condition: 'Unused surplus', quantity: 120, unit: 'sheets', totalPrice: 168000, mrp: 288000, minOrderQty: 20, locality: 'Peenya', specs: { sheetSize: '8 ft x 4 ft', thickness: '1.0 mm', finish: 'Matte', colour: 'Walnut' }, pickupDetails: 'Pickup from godown. Local delivery can be discussed.', description: 'Leftover from a completed project. Sealed bundles, stored indoors.' },
  { seller: 'b', daysAgo: 5, title: 'Vitrified floor tiles 600 x 600, stone grey', cat: 'tiles', subcategory: 'Vitrified tiles', brand: 'Sample Brand B', model: 'VT-660', condition: 'Discontinued stock', quantity: 86, unit: 'boxes', totalPrice: 129000, mrp: 215000, minOrderQty: 10, locality: 'Whitefield', specs: { tileSize: '600 x 600 mm', tilesPerBox: '4', coveragePerBox: '1.44 sq m', totalCoverage: '123.8 sq m', finish: 'Glossy', batchShade: 'Single batch' }, pickupDetails: 'Pickup only.', description: 'Single batch, matching shade across all boxes.' },
  { seller: 'c', daysAgo: 10, title: 'Black granite slabs, polished, 18 mm', cat: 'stone', subcategory: 'Granite', brand: '', model: '', condition: 'Unused surplus', quantity: 1, unit: 'lot', totalPrice: 240000, minOrderQty: null, locality: 'Yeshwanthpur', specs: { material: 'Black granite', slabs: '14', thickness: '18 mm', finish: 'Polished', approxArea: '180 sq ft' }, pickupDetails: 'Pickup from yard; loading support available.', description: 'Stock lot of 14 slabs from a cancelled order.' },
  { seller: 'd', daysAgo: 3, title: 'Fluted wall panels, smoked oak, 2.4 m', cat: 'louvers', subcategory: 'Wall panels', brand: 'Sample Brand C', model: 'FP-24', condition: 'Opened packaging', quantity: 60, unit: 'pcs', totalPrice: 48000, mrp: 96000, minOrderQty: 6, locality: 'HSR Layout', specs: { length: '2400 mm', width: '120 mm', finish: 'Smoked oak veneer' }, pickupDetails: 'Pickup or delivery.', description: 'Two packs opened for sampling; rest sealed.' },
  { seller: 'e', daysAgo: 15, title: 'Wall-hung toilets with concealed cisterns', cat: 'sanitaryware', subcategory: 'Toilets', brand: 'Sample Brand D', model: 'WH-90', condition: 'Unused surplus', quantity: 18, unit: 'pcs', totalPrice: 144000, mrp: 306000, minOrderQty: 2, locality: 'Jayanagar', specs: { colour: 'White', type: 'Wall-hung', includes: 'Seat cover' }, pickupDetails: 'Pickup from showroom.', description: 'Discontinued model, boxed.' },
  { seller: 'f', daysAgo: 13, title: 'Engineered wood decking boards, teak tone', cat: 'cladding-decking', subcategory: 'Decking', brand: 'Sample Brand E', model: 'DK-140', condition: 'Unused surplus', quantity: 220, unit: 'sq ft', totalPrice: 33000, mrp: 52800, minOrderQty: 50, locality: 'Electronic City', specs: { boardSize: '140 x 22 mm', length: '2200 mm', finish: 'Brushed' }, pickupDetails: 'Pickup only.', description: 'Left over from a terrace project.' },
  { seller: 'g', daysAgo: 4, title: 'Teak veneer plywood 6 mm, commercial grade', cat: 'veneers', subcategory: 'Veneer plywood', brand: 'Sample Brand F', model: 'TV-06', condition: 'Opened packaging', quantity: 75, unit: 'sheets', totalPrice: 86250, mrp: 138000, minOrderQty: 10, locality: 'Rajajinagar', specs: { sheetSize: '8 ft x 4 ft', thickness: '6 mm', finish: 'Natural' }, pickupDetails: 'Pickup from godown.', description: 'Some edge marks on the top sheets.' },
  { seller: 'h', daysAgo: 18, title: 'Solid wood panel doors with frames', cat: 'doors', subcategory: 'Interior doors', brand: 'Sample Brand G', model: 'PD-7', condition: 'Used', quantity: 9, unit: 'pcs', totalPrice: 63000, minOrderQty: 1, locality: 'Basavanagudi', specs: { size: '7 ft x 3 ft', frame: 'Included', finish: 'Polished' }, pickupDetails: 'Pickup from site.', description: 'Removed during renovation. Good condition.' },
];
