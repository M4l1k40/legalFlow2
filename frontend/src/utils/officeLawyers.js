import { isActiveCase } from '../constants/caseStatus.js';

function displayName(person) {
  const name = `${person?.firstName || ''} ${person?.lastName || ''}`.trim();
  return name || person?.username || 'Sans nom';
}

/** Avocats dont l'identifiant figure dans lawyerIds du client : ceux qui peuvent ouvrir un dossier pour lui. */
export function lawyersInChargeOf(client, lawyers) {
  const ids = Array.isArray(client?.lawyerIds) ? client.lawyerIds : [];
  return (Array.isArray(lawyers) ? lawyers : []).filter((lawyer) => ids.includes(lawyer.id));
}

/** Une ligne par avocat : clients en charge et dossiers, calculés à partir des listes déjà chargées. */
export function summarizeLawyers(lawyers, clients, cases) {
  const clientList = Array.isArray(clients) ? clients : [];
  const caseList = Array.isArray(cases) ? cases : [];

  return (Array.isArray(lawyers) ? lawyers : [])
    .map((lawyer) => {
      const myClients = clientList.filter((client) => Array.isArray(client.lawyerIds) && client.lawyerIds.includes(lawyer.id));
      const myCases = caseList.filter((item) => item.lawyerId === lawyer.id);
      return {
        id: lawyer.id,
        name: displayName(lawyer),
        username: lawyer.username || '',
        clientCount: myClients.length,
        clientNames: myClients.map(displayName).sort((a, b) => a.localeCompare(b, 'fr')),
        activeCases: myCases.filter(isActiveCase).length,
        totalCases: myCases.length
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
