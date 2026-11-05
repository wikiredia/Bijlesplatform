// Startinhoud voor de tutorpagina's. Dit is maar een vertrekpunt:
// Yeno en Reda passen hun tekst en projecten aan via /beheer → Mijn profiel.

export const defaultProfiles = {
  yeno: {
    headline: 'Wiskunde en fysica, stap voor stap uitgelegd',
    bio:
      'Hoi, ik ben Yeno! Ik geef bijles wiskunde en fysica, van het 1ste tot en met het 6de middelbaar.\n\n' +
      'Ik vertrek van wat je al kent en werk naar de leerstof toe met veel oefeningen en duidelijke tussenstappen. ' +
      'Of het nu gaat om een toets volgende week of om de basis eindelijk goed onder de knie te krijgen: samen zoeken we hoe het voor jou klikt.\n\n' +
      '(Deze tekst is een voorbeeld — pas hem aan via het beheerpaneel.)',
    highlights: ['1ste – 6de middelbaar', 'Toetsen & examens voorbereiden', 'Aan huis of online'],
    projects: [
      { title: 'Voorbeeldproject', description: 'Beschrijf hier een project waar je trots op bent.', url: '', tags: ['wiskunde'] },
      { title: 'Nog een project', description: 'Bijvoorbeeld een opdracht, wedstrijd of eigen experiment.', url: '', tags: ['fysica'] },
    ],
  },
  reda: {
    headline: 'Programmeren en ICT, van eerste regel code tot eigen project',
    bio:
      'Hoi, ik ben Reda! Ik help je met programmeren en ICT, tot en met het 6de middelbaar.\n\n' +
      'Python, webontwikkeling, algoritmes of gewoon snappen hoe een computer werkt: ik leg het uit aan de hand van ' +
      'concrete mini-projecten, zodat je meteen ziet waarom iets werkt.\n\n' +
      '(Deze tekst is een voorbeeld — pas hem aan via het beheerpaneel.)',
    highlights: ['Python, web & meer', 'Projectwerk & taken', 'Aan huis of online'],
    projects: [
      { title: 'Voorbeeldproject', description: 'Beschrijf hier een app, website of tool die je bouwde.', url: '', tags: ['web'] },
      { title: 'Nog een project', description: 'Voeg een link toe naar GitHub of een demo.', url: '', tags: ['python'] },
    ],
  },
};
