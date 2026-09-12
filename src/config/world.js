
export const worldConfig = {
  navigation: {
    breadcrumbLimit: 7,
  },
  destinations: [
    {
      id: 'town-square',
      label: 'Town Square',
      category: 'Social',
      accent: '#7fae9b',
      approach: [0, 0.25, 1],
      entrance: [0, 0.25, -6],
    },
    {
      id: 'workshop',
      label: 'Workshop',
      category: 'Create',
      accent: '#c7a55b',
      approach: [-12, 0.25, 8],
      entrance: [-12, 0.25, 3],
    },
    {
      id: 'pollinator-garden',
      label: 'Pollinator Garden',
      category: 'Explore',
      accent: '#7da36f',
      approach: [18, 0.25, -1],
      entrance: [13, 0.25, -1],
    },
  ],
}

