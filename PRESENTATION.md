# Present JanSuvidha on phones

No cloud account or APK is needed for this mode. The laptop runs the application and MySQL; phones open it in a browser. Android Chrome and iPhone Safari can use the same link. It is a local presentation, not a public website.

## Before presenting

1. Connect the laptop and every phone to the same Wi-Fi. Alternatively, turn on one phone's hotspot and connect the laptop and other phones to it. A hotspot with mobile data can also supply the internet connection needed for map tiles.
2. Ensure the MySQL Windows service is running.
3. In the project terminal, run `npm run presentation`.
4. Open the **Phone presentation link** printed in the terminal on each phone. The current Wi-Fi address is `http://192.168.0.103:4174`; it can change after switching networks, so use the newly printed address each time.
5. Keep the laptop awake and leave the terminal running throughout the presentation. Stop it with Ctrl+C afterward.

The ordinary localhost server can stay running on port 4173. Presentation mode uses 4174, binds only to the selected private IPv4 interface, and rejects public IP bindings and production configuration. It does not rewrite `.env` or expose MySQL to phones.

This demonstration uses HTTP on your trusted local network and staff MFA is deferred. Use test passwords and fictional complaints. Do not forward the port or put this mode behind a public tunnel. Phones on mobile data alone cannot reach it.

## Presentation flow

- **Citizen:** open Citizen login / register, create a test citizen, save recovery codes, then Submit a complaint. The pilot department and jurisdiction are preselected when they are the only choices. My complaints shows that citizen's reports.
- **Administrator:** open Government portal and sign in with the administrator created by `npm run auth:bootstrap`. Review complaints, invite/approve officers, and assign matching complaints.
- **Officer invitations:** use `npm run presentation:invite` in a second terminal to generate development invitation/reset links with the phone-accessible address. The ordinary `auth:dev-link` command uses the localhost address from `.env` instead.
- **Officer:** accept the invitation, have the administrator activate the account, then sign in through Government portal. Assigned complaints must match their department and jurisdiction.
- Citizen and staff cookies are separate. The local IP address also has separate browser cookies from localhost, so sign in again when opening the phone link.
- Street tiles need internet access. The facility dataset and bundled map library are served from the laptop. Resolution remains blocked until evidence support is added.

## If a phone cannot open the page

- Confirm the full `http://...:4174` address; `localhost` on a phone means the phone itself.
- Confirm both devices are on the same network. Guest Wi-Fi often blocks device-to-device connections; use a trusted personal hotspot instead.
- Windows Firewall must allow incoming TCP 4174 from the local subnet. If access is blocked, request a narrowly scoped presentation firewall rule; do not disable the firewall.
- If several private interfaces are detected, choose the Wi-Fi/hotspot address printed by the launcher and run `$env:PRESENTATION_HOST='192.168.x.x'` in PowerShell before `npm run presentation`.
- Close another presentation process if port 4174 is already in use.

You may bookmark the link or use the browser's Add to Home Screen shortcut. The shortcut still requires the laptop server and the same network; it is not an offline or publicly hosted app.
