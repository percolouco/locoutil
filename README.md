# LocOutil — Gestion de location d'outils

Application web de gestion de location d'outils. Permet de gérer le catalogue d'outils, les clients, les réservations et d'avoir une vue calendrier de la disponibilité.

## Fonctionnalités

### Outils
- Fiche outil : nom, catégorie, description, photos multiples
- Tarifs : prix à la journée, prix week-end, caution
- Notes internes
- Historique des locations par outil

### Clients
- Fiche client : nom, téléphone, email, adresse, notes
- Upload de documents (pièces d'identité, etc.) avec libellé personnalisable
- Historique des locations par client

### Locations
- Lien outil + client + plateforme + dates
- Calcul automatique du prix selon la durée
- Suivi caution (encaissée / rendue)
- Statuts : Confirmée / En cours / Retournée / Annulée
- Notes de retour (état de l'outil à la restitution)

### Calendrier
- Vue mensuelle avec toutes les locations actives
- Clic sur un événement pour voir le détail

### Plateformes
- Liste éditable (Leboncoin, Direct, etc.)
- Associée à chaque location pour le suivi des sources

### Dashboard
- Locations en cours, revenus du mois, revenus total
- Cautions en attente de retour
- Retours prévus dans les 7 jours

## Stack

- **Backend** : Python FastAPI + SQLite
- **Frontend** : HTML/CSS/JS vanilla
- **Déploiement** : Docker + Traefik

## Déploiement

```bash
cd /opt/container/locoutil
docker compose up -d --build
```

Accessible sur **https://locoutil.nas.percolouco.com**

## Structure

```
locoutil/
├── app/
│   ├── main.py              # App FastAPI + dashboard
│   ├── database.py          # SQLite + schéma
│   └── routers/
│       ├── tools.py         # CRUD outils + images
│       ├── clients.py       # CRUD clients + documents
│       ├── rentals.py       # CRUD locations + calendrier
│       └── platforms.py     # CRUD plateformes
├── static/
│   ├── style.css
│   └── app.js
├── templates/
│   └── index.html
├── Dockerfile
└── requirements.txt
```

Les données sont persistées dans `/opt/container/locoutil/data/` (SQLite) et `/opt/container/locoutil/uploads/` (fichiers).
