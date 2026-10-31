// Rough, transparent numbers for what a plot of residue is worth to the air and to a kiln.
// Sources for the factors are the usual published averages; they are estimates, not measurements.
const { CROPS } = require('./constants');

const CO2_PER_T = { paddy: 1.46, default: 1.5 };   // t CO2 released per t of residue burned in the open
const PM25_KG_PER_T = { paddy: 8.3, default: 7 };  // kg PM2.5 per t burned
const ENERGY_MJ_PER_KG = 14;                        // usable heat in dry crop residue
const COAL_MJ_PER_KG = 20;                          // typical kiln coal
const MJ_PER_BRICK = 4;                             // fuel to fire one clay brick, roughly

function baseline(crop, acres, tonnes) {
  const t = tonnes ?? acres * (CROPS[crop]?.tpa ?? CROPS.other.tpa);
  const r = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  return {
    tonnes: r(t),
    co2_avoided_t: r(t * (CO2_PER_T[crop] ?? CO2_PER_T.default)),
    pm25_avoided_kg: Math.round(t * (PM25_KG_PER_T[crop] ?? PM25_KG_PER_T.default)),
    bricks: Math.round((t * 1000 * ENERGY_MJ_PER_KG * 0.85) / MJ_PER_BRICK / 100) * 100,
    coal_replaced_t: r((t * ENERGY_MJ_PER_KG * 0.85) / COAL_MJ_PER_KG),
  };
}

module.exports = { baseline };
