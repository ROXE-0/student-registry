import { FormEvent, useEffect, useState } from "react";
import { formatEther } from "viem";
import { useAccount, useBalance, useChainId, useConnect, useDisconnect } from "wagmi";
import {
  useAllRegisteredStudents,
  useLoggedInStudent,
  useRegisterStudent,
} from "./hooks";

function shorten(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const balance = useBalance({ address });
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [course, setCourse] = useState("");

  const student = useLoggedInStudent();
  const allStudents = useAllRegisteredStudents();
  const registration = useRegisterStudent();

  useEffect(() => {
    if (registration.isConfirmed) {
      setNotice("Registration confirmed on-chain.");
      setName("");
      setAge("");
      setCourse("");
      allStudents.refetch();
      student.refetch();
    }
  }, [registration.isConfirmed]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");

    if (!name.trim() || !course.trim() || !age) {
      setNotice("Enter your name, age and course.");
      return;
    }

    const numericAge = Number(age);
    if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 150) {
      setNotice("Age must be a valid whole number.");
      return;
    }

    try {
      registration.register(name.trim(), BigInt(numericAge), course.trim());
      setNotice("Transaction submitted. Confirm it in your wallet.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Transaction failed.");
    }
  }

  const currentStudent =
    student.data && Array.isArray(student.data) ? student.data : null;

  return (
    <main className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">BLOCKCHAIN STUDENT REGISTRATION</p>
          <h1>Student Registration dApp</h1>
          <p className="subtitle">
            Register students, read the connected student's details, and batch
            registered-student reads with multicall.
          </p>
        </div>

        <WalletButton />
      </header>

      <div className="network">
        <span>Network ID: {chainId}</span>
        <span>
          {address ? shorten(address) : "Wallet not connected"}
          {balance.data ? ` · ${Number(formatEther(balance.data.value)).toFixed(4)} ETH` : ""}
        </span>
      </div>

      {notice && <div className="notice">{notice}</div>}

      <section className="grid">
        <section className="card">
          <div className="card-title">
            <span className="number">01</span>
            <div>
              <h2>Register Student</h2>
              <p>Calls <code>register()</code> on the exact Solidity contract.</p>
            </div>
          </div>

          <form onSubmit={submit}>
            <label>
              Full name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                disabled={!isConnected || registration.isPending}
              />
            </label>

            <label>
              Age
              <input
                type="number"
                min="1"
                max="150"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="21"
                disabled={!isConnected || registration.isPending}
              />
            </label>

            <label>
              Course
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="Computer Science"
                disabled={!isConnected || registration.isPending}
              />
            </label>

            <button disabled={!isConnected || registration.isPending}>
              {registration.isPending ? "Confirm in wallet..." : "Register Student"}
            </button>
          </form>

          {registration.hash && (
            <p className="tx">
              Transaction: <span>{shorten(registration.hash)}</span>
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-title">
            <span className="number">02</span>
            <div>
              <h2>My Details</h2>
              <p>Calls <code>getStudent(msg.sender)</code> for the logged-in wallet.</p>
            </div>
          </div>

          {!isConnected ? (
            <Empty text="Connect your wallet to view your registered details." />
          ) : student.isLoading ? (
            <Empty text="Reading the blockchain..." />
          ) : student.error ? (
            <Empty text="This wallet is not registered yet." />
          ) : currentStudent ? (
            <StudentDetails
              address={address!}
              name={String(currentStudent[0])}
              age={currentStudent[1] as bigint}
              course={String(currentStudent[2])}
            />
          ) : (
            <Empty text="No registered student found for this wallet." />
          )}
        </section>
      </section>

      <section className="card all-card">
        <div className="card-title">
          <span className="number">03</span>
          <div>
            <h2>All Registered Students</h2>
            <p>
              Student addresses are read in one <code>multicall</code> batch.
            </p>
          </div>
          <button
            className="secondary refresh"
            onClick={() => allStudents.refetch()}
            disabled={allStudents.isFetching}
          >
            {allStudents.isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="limitation">
          <strong>Important:</strong> the supplied Solidity contract stores
          students in a mapping but does not expose a list of registered
          addresses or emit a registration event. This frontend therefore
          remembers addresses that register through this frontend. To discover
          students registered before this frontend was used, supply an
          indexer/address list and the same multicall function can read them.
        </div>

        {allStudents.isLoading ? (
          <Empty text="Batch-reading students..." />
        ) : allStudents.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Course</th>
                </tr>
              </thead>
              <tbody>
                {allStudents.data.map((s, index) => (
                  <tr key={s.address}>
                    <td>{index + 1}</td>
                    <td><code>{shorten(s.address)}</code></td>
                    <td>{s.name}</td>
                    <td>{s.age.toString()}</td>
                    <td>{s.course}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No known registered students yet." />
        )}
      </section>

      <footer>
        Contract address: <code>{import.meta.env.VITE_STUDENT_REGISTRATION_ADDRESS || "not configured"}</code>
      </footer>
    </main>
  );
}

function WalletButton() {
  const account = useAccount();
  const connector = useConnect();
  const disconnect = useDisconnect();

  if (account.isConnected) {
    return (
      <button className="wallet connected" onClick={() => disconnect.disconnect()}>
        {shorten(account.address!)} · Disconnect
      </button>
    );
  }

  return (
    <button
      className="wallet"
      onClick={() => connector.connect({ connector: connector.connectors[0] })}
      disabled={connector.isPending || connector.connectors.length === 0}
    >
      {connector.isPending ? "Connecting..." : "Connect MetaMask"}
    </button>
  );
}

function StudentDetails({
  address,
  name,
  age,
  course,
}: {
  address: string;
  name: string;
  age: bigint;
  course: string;
}) {
  return (
    <div className="details">
      <div className="profile">
        <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h3>{name}</h3>
          <code>{shorten(address)}</code>
        </div>
      </div>
      <div className="detail-row">
        <span>Age</span>
        <strong>{age.toString()}</strong>
      </div>
      <div className="detail-row">
        <span>Course</span>
        <strong>{course}</strong>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default App;
