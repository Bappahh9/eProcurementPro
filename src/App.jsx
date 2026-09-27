import { useState } from "react";
import { ethers } from "ethers";

import abi from "./contract/abi.json";
import { CONTRACT_ADDRESS } from "./contract/config";

function App() {
  const [account, setAccount] = useState("");
  const [admin, setAdmin] = useState("");
  const [network, setNetwork] = useState("");
  const [status, setStatus] = useState("Not Connected");

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask");
        return;
      }

      setStatus("Connecting...");

      const provider = new ethers.BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();

      const address = await signer.getAddress();

      const net = await provider.getNetwork();

      setAccount(address);
      setNetwork(net.name);

      const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  abi,
  signer
);

// DEBUG
console.log("Contract Object:", contract);
console.log("ABI:", abi);
console.log(
  "Functions:",
  abi
    .filter((item) => item.type === "function")
    .map((item) => item.name)
);

// Try to read admin
const adminAddress = await contract.bppAdmin();

setAdmin(adminAddress);

      setStatus("Connected Successfully");
    } catch (err) {
      console.error(err);
      setStatus("Connection Failed");
    }
  }

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "50px auto",
        padding: "20px",
        fontFamily: "Arial",
      }}
    >
      <h1>Blockchain Public E-Procurement</h1>

      <button
        onClick={connectWallet}
        style={{
          padding: "12px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Connect MetaMask
      </button>

      <hr />

      <h3>Status</h3>
      <p>{status}</p>

      <h3>Connected Wallet</h3>
      <p>{account || "Not connected"}</p>

      <h3>Network</h3>
      <p>{network || "Unknown"}</p>

      <h3>Contract Admin (from blockchain)</h3>
      <p>{admin || "Not loaded"}</p>
    </div>
  );
}

export default App;