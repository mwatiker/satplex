export interface LunarPOI {
  name: string;
  lat: number;
  lng: number;
  description: string;
  type: 'landing_site' | 'crater' | 'maria' | 'mountain' | 'oceanus';
}

export const LUNAR_POIS: LunarPOI[] = [
  // Apollo Landing Sites
  { name: 'Apollo 11', lat: 0.67408, lng: 23.47297, description: 'First human landing on the Moon (Tranquility Base), 1969.', type: 'landing_site' },
  { name: 'Apollo 12', lat: -3.01239, lng: -23.42157, description: 'Landing at Oceanus Procellarum, 1969.', type: 'landing_site' },
  { name: 'Apollo 14', lat: -3.6453, lng: -17.47136, description: 'Landing at Fra Mauro highlands, 1971.', type: 'landing_site' },
  { name: 'Apollo 15', lat: 26.13222, lng: 3.63386, description: 'Landing at Hadley-Apennine, 1971.', type: 'landing_site' },
  { name: 'Apollo 16', lat: -8.97301, lng: 15.49859, description: 'Landing at Descartes highlands, 1972.', type: 'landing_site' },
  { name: 'Apollo 17', lat: 20.1908, lng: 30.77168, description: 'Final Apollo landing at Taurus-Littrow, 1972.', type: 'landing_site' },

  // Soviet Luna Program
  { name: 'Luna 2', lat: 29.1, lng: 0.0, description: 'First man-made object to reach the Moon, 1959.', type: 'landing_site' },
  { name: 'Luna 9', lat: 7.08, lng: -64.37, description: 'First soft landing on the Moon, 1966.', type: 'landing_site' },
  { name: 'Luna 16', lat: -0.68, lng: 56.30, description: 'First robotic sample return mission, 1970.', type: 'landing_site' },
  { name: 'Luna 17', lat: 38.28, lng: -35.00, description: 'Landing site of Lunokhod 1 rover, 1970.', type: 'landing_site' },
  { name: 'Luna 21', lat: 25.85, lng: 30.45, description: 'Landing site of Lunokhod 2 rover, 1973.', type: 'landing_site' },

  // Modern Missions
  { name: 'Chang\'e 3', lat: 44.12, lng: -19.51, description: 'Chinese mission with Yutu rover, 2013.', type: 'landing_site' },
  { name: 'Chang\'e 4', lat: -45.44, lng: 177.59, description: 'First soft landing on the lunar far side, 2019.', type: 'landing_site' },
  { name: 'Chang\'e 5', lat: 43.06, lng: -51.92, description: 'Chinese sample return mission, 2020.', type: 'landing_site' },
  { name: 'SLIM', lat: -13.31, lng: 25.25, description: 'Japanese "Moon Sniper" precision landing site, 2024.', type: 'landing_site' },
  { name: 'Odysseus (IM-1)', lat: -80.13, lng: 1.44, description: 'First private spacecraft to land on the Moon, 2024.', type: 'landing_site' },

  // Craters (Major/Notable)
  { name: 'Tycho', lat: -43.3, lng: -11.2, description: 'Prominent impact crater with bright rays visible from Earth.', type: 'crater' },
  { name: 'Copernicus', lat: 9.7, lng: -20.0, description: 'Large, complex crater in Oceanus Procellarum.', type: 'crater' },
  { name: 'Aristarchus', lat: 23.7, lng: -47.4, description: 'The brightest crater on the lunar surface.', type: 'crater' },
  { name: 'Plato', lat: 51.6, lng: -9.4, description: 'Dark-floored crater known for its smooth appearance.', type: 'crater' },
  { name: 'Kepler', lat: 8.1, lng: -38.0, description: 'Bright rayed crater named after Johannes Kepler.', type: 'crater' },
  { name: 'Grimaldi', lat: -5.2, lng: -68.6, description: 'Large impact basin near the western limb.', type: 'crater' },
  { name: 'Langrenus', lat: -8.9, lng: 61.1, description: 'Large crater near the eastern edge of Mare Fecunditatis.', type: 'crater' },
  { name: 'Tsiolkovskiy', lat: -20.4, lng: 128.5, description: 'Spectacular crater on the far side with a dark floor.', type: 'crater' },
  { name: 'Shackleton', lat: -89.9, lng: 0.0, description: 'Crater at the lunar South Pole, often in perpetual shadow.', type: 'crater' },

  // Maria (Seas)
  { name: 'Mare Tranquillitatis', lat: 8.5, lng: 28.3, description: 'Sea of Tranquility - landing site of Apollo 11.', type: 'maria' },
  { name: 'Mare Imbrium', lat: 32.8, lng: -15.6, description: 'Sea of Showers - one of the largest impact basins.', type: 'maria' },
  { name: 'Mare Serenitatis', lat: 28.0, lng: 17.5, description: 'Sea of Serenity.', type: 'maria' },
  { name: 'Mare Crisium', lat: 17.0, lng: 59.1, description: 'Sea of Crises - a distinct isolated basin.', type: 'maria' },
  { name: 'Mare Fecunditatis', lat: -7.8, lng: 51.3, description: 'Sea of Fertility.', type: 'maria' },
  { name: 'Mare Nectaris', lat: -15.2, lng: 35.5, description: 'Sea of Nectar.', type: 'maria' },
  { name: 'Mare Humorum', lat: -24.4, lng: -38.6, description: 'Sea of Moisture.', type: 'maria' },
  { name: 'Mare Nubium', lat: -21.3, lng: -16.6, description: 'Sea of Clouds.', type: 'maria' },
  { name: 'Mare Orientale', lat: -19.4, lng: -92.8, description: 'Striking multi-ringed impact basin on the western limb.', type: 'maria' },
  { name: 'Mare Moscoviense', lat: 27.3, lng: 147.9, description: 'One of the few maria on the far side of the Moon.', type: 'maria' },
  { name: 'Oceanus Procellarum', lat: 18.4, lng: -57.4, description: 'Ocean of Storms - the largest of the lunar maria.', type: 'oceanus' },

  // Mountains / Ranges
  { name: 'Mons Huygens', lat: 19.6, lng: 2.9, description: 'The Moon\'s highest mountain, located in the Montes Apenninus.', type: 'mountain' },
  { name: 'Montes Apenninus', lat: 18.9, lng: 3.7, description: 'Spectacular mountain range forming the SE border of Mare Imbrium.', type: 'mountain' },
  { name: 'Montes Caucasus', lat: 38.4, lng: 10.0, description: 'Rugged mountain range between Mare Imbrium and Mare Serenitatis.', type: 'mountain' },
  { name: 'Mons Hadley', lat: 26.5, lng: 4.7, description: 'Mountain near the Apollo 15 landing site.', type: 'mountain' },
  { name: 'Mons Pico', lat: 45.7, lng: -8.9, description: 'Isolated mountain rising from the floor of Mare Imbrium.', type: 'mountain' },
];
