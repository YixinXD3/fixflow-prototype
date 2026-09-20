# FixFlow prototype

Open https://yixinxd3.github.io/fixflow-prototype/ and choose **Repair Technician** or **Customer**. Both roles can log out to switch.

Customers can request repairs, select technicians and see their managers, track progress and send local demo messages. Technicians retain their existing repair and collaboration workspace. Customer requests and technician progress share data only within the same browser tab.

No framework, backend, real authentication or AI API is used. Photos and messages remain in sessionStorage or memory; data is not shared between visitors. Do not use real customer information in this public demonstration.

Run locally: `python3 -m http.server 5173` and open http://localhost:5173. There is no build step. Check JavaScript with `node --check app.js` and `node --check customer.js`. GitHub Pages serves the main branch root.
