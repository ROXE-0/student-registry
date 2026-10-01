import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, Interface, isAddress, getAddress } from "ethers";
import { CONTRACT_ADDRESS, MULTICALL3, SEPOLIA_CHAIN_ID, STUDENT_ABI, MULTICALL_ABI } from "./abi";

const KEY = "student-registry:addresses";
const SEED = ["0x5D9df8d4b77E21d6639C81A2abfBe812396dB313"]; // first known registrant
const iface = new Interface(STUDENT_ABI);
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const loadKnown = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || SEED; } catch { return SEED; }
};

export default function App() {
  const [account, setAccount] = useState(null);
  const [signer, setSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [me, setMe] = useState(null); // null = unknown, false = not registered
  const [form, setForm] = useState({ name: "", age: "", course: "" });
  const [known, setKnown] = useState(loadKnown);
  const [extra, setExtra] = useState("");
  const [students, setStudents] = useState([]);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_ETHERSCAN_KEY || "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(known)); }, [known]);

  const addKnown = useCallback((addrs) => {
    setKnown((prev) => {
      const set = new Set(prev.map((a) => a.toLowerCase()));
      const next = [...prev];
      addrs.forEach((a) => {
        if (isAddress(a) && !set.has(a.toLowerCase())) { set.add(a.toLowerCase()); next.push(getAddress(a)); }
      });
      return next;
    });
  }, []);

  async function connect() {
    if (!window.ethereum) return setStatus("No wallet found. Install MetaMask and reload.");
    try {
      const p = new BrowserProvider(window.ethereum);
      await p.send("eth_requestAccounts", []);
      if (Number((await p.getNetwork()).chainId) !== SEPOLIA_CHAIN_ID) {
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
      }
      const p2 = new BrowserProvider(window.ethereum); // refresh after network switch
      const s = await p2.getSigner();
      setProvider(p2); setSigner(s); setAccount(await s.getAddress()); setStatus("");
    } catch (e) { setStatus(e.shortMessage || e.message); }
  }

  const loadMe = useCallback(async () => {
    if (!provider || !account) return;
    const c = new Contract(CONTRACT_ADDRESS, STUDENT_ABI, provider);
    if (!(await c.registered(account))) return setMe(false);
    const [name, age, course] = await c.getStudent(account);
    setMe({ name, age: age.toString(), course });
  }, [provider, account]);

  useEffect(() => { loadMe().catch((e) => setStatus(e.shortMessage || e.message)); }, [loadMe]);

  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on?.("accountsChanged", reload);
    window.ethereum.on?.("chainChanged", reload);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", reload);
      window.ethereum.removeListener?.("chainChanged", reload);
    };
  }, []);

  async function register(e) {
    e.preventDefault();
    const age = Number(form.age);
    if (!form.name.trim() || !form.course.trim() || !Number.isInteger(age) || age <= 0)
      return setStatus("Enter a name, a whole-number age and a course.");
    setBusy(true); setStatus("Confirm the transaction in your wallet…");
    try {
      const c = new Contract(CONTRACT_ADDRESS, STUDENT_ABI, signer);
      const tx = await c.register(form.name.trim(), age, form.course.trim());
      setStatus("Waiting for confirmation…");
      await tx.wait();
      addKnown([account]);
      await loadMe();
      setStatus("Registered.");
    } catch (err) { setStatus(err.reason || err.shortMessage || err.message); }
    setBusy(false);
  }

  // Fetch every known address's record in ONE eth_call through Multicall3.
  async function loadAll() {
    if (!provider) return setStatus("Connect your wallet first.");
    setBusy(true); setStatus("Fetching with multicall…");
    try {
      const pasted = extra.split(/[\s,;]+/).filter(isAddress);
      const list = [...new Set([...known, ...pasted].map((a) => getAddress(a)))];
      addKnown(pasted);
      const mc = new Contract(MULTICALL3, MULTICALL_ABI, provider);
      const calls = list.map((a) => ({
        target: CONTRACT_ADDRESS,
        allowFailure: true, // getStudent reverts for unregistered addresses
        callData: iface.encodeFunctionData("getStudent", [a]),
      }));
      const res = await mc.aggregate3.staticCall(calls);
      const out = [];
      res.forEach((r, i) => {
        if (!r.success) return;
        const [name, age, course] = iface.decodeFunctionResult("getStudent", r.returnData);
        out.push({ address: list[i], name, age: age.toString(), course });
      });
      setStudents(out);
      setStatus(`${out.length} registered of ${list.length} addresses checked.`);
    } catch (err) { setStatus(err.shortMessage || err.message); }
    setBusy(false);
  }

  // Optional: discover registrants from Etherscan tx history (needs a free API key).
  async function importFromEtherscan() {
    if (!apiKey) return setStatus("Add an Etherscan API key to import registrants.");
    setBusy(true); setStatus("Reading contract transactions…");
    try {
      const url = `https://api.etherscan.io/v2/api?chainid=${SEPOLIA_CHAIN_ID}&module=account&action=txlist&address=${CONTRACT_ADDRESS}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`;
      const json = await (await fetch(url)).json();
      if (!Array.isArray(json.result)) throw new Error(json.result || json.message);
      const froms = json.result
        .filter((t) => t.isError === "0" && t.methodId === "0x637a0832")
        .map((t) => t.from);
      addKnown(froms);
      setStatus(`Imported ${new Set(froms).size} registrant address(es). Press “Fetch all students”.`);
    } catch (err) { setStatus(err.message); }
    setBusy(false);
  }

  return (
    <main>
      <header>
        <div>
          <h1>Student Registry</h1>
          <p className="sub">Sepolia · <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{short(CONTRACT_ADDRESS)}</a></p>
        </div>
        {account ? <span className="pill">{short(account)}</span> : <button onClick={connect}>Connect wallet</button>}
      </header>

      {status && <p className="status" role="status">{status}</p>}

      <section>
        <h2>My record</h2>
        {!account && <p className="muted">Connect your wallet to see your record.</p>}
        {account && me === null && <p className="muted">Loading…</p>}
        {me && (
          <dl>
            <dt>Name</dt><dd>{me.name}</dd>
            <dt>Age</dt><dd>{me.age}</dd>
            <dt>Course</dt><dd>{me.course}</dd>
          </dl>
        )}
        {me === false && (
          <form onSubmit={register}>
            <p className="muted">This wallet isn’t registered yet.</p>
            <label>Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Age<input type="number" min="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></label>
            <label>Course<input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} /></label>
            <button disabled={busy}>Register student</button>
          </form>
        )}
      </section>

      <section>
        <h2>All students</h2>
        <p className="muted">
          The contract has no student list or events, so the app multicalls <code>getStudent</code> for every address it knows ({known.length}).
          Add more below, or import them from Etherscan.
        </p>
        <textarea rows="2" placeholder="Paste extra wallet addresses (comma or space separated)" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <div className="row">
          <input type="password" placeholder="Etherscan API key (optional)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <button className="ghost" onClick={importFromEtherscan} disabled={busy}>Import registrants</button>
          <button onClick={loadAll} disabled={busy}>Fetch all students</button>
        </div>
        {students.length > 0 && (
          <div className="scroll">
            <table>
              <thead><tr><th>Wallet</th><th>Name</th><th>Age</th><th>Course</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.address}>
                    <td><a href={`https://sepolia.etherscan.io/address/${s.address}`} target="_blank" rel="noreferrer">{short(s.address)}</a></td>
                    <td>{s.name}</td><td>{s.age}</td><td>{s.course}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
