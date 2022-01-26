import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import './App.css';
import wavePortalAbi from './utils/WavePortal.json';

export default function App() {
  const [currentAccount, setCurrentAccount] = useState("");
  const [lastTxn, setLastTxn] = useState("");
  const [waveCount, setWaveCount] = useState(null);
  const [isMining, setIsMining] = useState(false);
  const [message, setMessage] = useState('');
  /*
   * All state property to store all waves
   */
  const [allWaves, setAllWaves] = useState([]);

  /**
   * Create a variable here that holds the contract address after you deploy!
   */
  const contractAddress = "0x6909e506FBEc9F2738226b0b73eC2AAee7de6489";
  const contractABI = wavePortalAbi.abi;

  const checkIfWalletIsConnected = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        console.log('Ethereum is connected');
      } else {
        console.error('Metamask need to be installed');
        return;
      }

      /*
      * Check if we're authorized to access the user's wallet
      */
      const accounts = await ethereum.request({ method: "eth_accounts" });

      if (accounts.length !== 0) {
        const account = accounts[0]; // Note that we're only grabbing first account for now
        console.log("Found an authorized account:", account);
        setCurrentAccount(account);

        // NOTE: Fetch or update anything from/in smart contract only after user is authorized and connected to the app
        postAuthorizationActions();
      } else {
        console.log("No authorized account found")
      }
    } catch(error) {
      console.error(error);
    }
  }

  /**
  * Implement your connectWallet method here
  */
  const connectWallet = async () => {
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Get MetaMask!");
        return;
      }

      const accounts = await ethereum.request({ method: "eth_requestAccounts" });

      console.log("Connected", accounts[0]);
      setCurrentAccount(accounts[0]);
    } catch (error) {
      console.log(error)
    }
  }

  const postAuthorizationActions = () => {
    initializeWaveCounter();
    getAllWaves();
  }

  const getTotalWaveCount = async () => {
    const wavePortalContract = getWaveContract();
    const totalWaveCount = await wavePortalContract.getTotalWaves();
    return totalWaveCount.toNumber();
  }

  const initializeWaveCounter = async () => {
    const totalWaveCount = await getTotalWaveCount();
    setWaveCount(totalWaveCount);
  }

  useEffect(() => {
    checkIfWalletIsConnected();
  }, []);

  const getSigner = () => {
    if (!ethereum) {
      return null;
    }
    const provider = new ethers.providers.Web3Provider(ethereum);
    return provider.getSigner();
  };

  const getWaveContract = () => {
    return new ethers.Contract(contractAddress, contractABI, getSigner());
  }

  /*
   * Create a method that gets all waves from your contract
   */
  const getAllWaves = async () => {
    try {
      const { ethereum } = window;
      if (ethereum) {
        const wavePortalContract = getWaveContract();

        /*
         * Call the getAllWaves method from your Smart Contract
         */
        const waves = await wavePortalContract.getAllWaves();


        /*
         * We only need address, timestamp, and message in our UI so let's
         * pick those out
         */
        let wavesCleaned = [];
        waves.forEach(wave => {
          wavesCleaned.push({
            address: wave.waver,
            timestamp: new Date(wave.timestamp * 1000),
            message: wave.message
          });
        });

        /*
         * Store our data in React State
         */
        setAllWaves(wavesCleaned);
      } else {
        console.log("Ethereum object doesn't exist!")
      }
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Listen in for emitter events!
   */
  useEffect(() => {
    let wavePortalContract;

    const onNewWave = (from, timestamp, message) => {
      console.log("NewWave", from, timestamp, message);
      setAllWaves(prevState => [
        ...prevState,
        {
          address: from,
          timestamp: new Date(timestamp * 1000),
          message: message,
        },
      ]);
    };

    const { ethereum } = window;
    if (ethereum) {
      const provider = new ethers.providers.Web3Provider(ethereum);
      const signer = provider.getSigner();

      wavePortalContract = new ethers.Contract(contractAddress, contractABI, signer);
      
      // Listen to "NewWave" event
      wavePortalContract.on("NewWave", onNewWave);
    }

    return () => {
      if (wavePortalContract) {
        // Cleanup the event listener
        wavePortalContract.off("NewWave", onNewWave);
      }
    };
  }, []);

  const wave = async () => {
    try {
      if (!message) {
        alert('Please wave with a message!');
        return;
      }

      const { ethereum } = window;

      if (ethereum) {
        setIsMining(true);
        const wavePortalContract = getWaveContract();

        let count = await getTotalWaveCount();
        console.log("Retrieved total wave count...", count);

        /*
        * Execute the actual wave from your smart contract
        */
        const waveTxn = await wavePortalContract.wave(message, { gasLimit: 300000 });
        // NOTE: Estimating gas is a hard problem and an easy workaround for this (so our users don't get angry when a transaction fails) is to set a limit.
        // What this does is make the user pay a set amount of gas of 300,000. And, if they don't use all of it in the transaction they'll automatically be refunded.

        setLastTxn(waveTxn.hash);
        console.log("Mining...", waveTxn.hash);


        await waveTxn.wait();
        console.log("Mined -- ", waveTxn.hash);
        setMessage(''); // Reset message text
        setIsMining(false);

        count = await getTotalWaveCount();
        setWaveCount(count);
        console.log("Retrieved total wave count...", count);

      } else {
        console.log("Ethereum object doesn't exist!");
      }
    } catch (error) {
      alert(error.message);
      console.log(error);
      setIsMining(false);
    }
  }

  function onMessageChange(e) {
    setMessage(e.target.value);
  }

  return (
    <div className="mainContainer">
      <div className="dataContainer">
        <div className="header">
        👋 Hey there!
        </div>

        <div className="bio">
        I am Kartik and I work on self-destructive cars so that's pretty cool right? Connect your Ethereum wallet and wave at me!
        </div>

        {!currentAccount ? (
          <button className="waveButton" onClick={connectWallet}>
            Connect Wallet
          </button>
        ): (
          <>
          <div className="waveContainer">
            <label>Message</label>
            <input type="text" className="inputField" placeholder="Type your message here!" value={message} onChange={onMessageChange} />
            <button className={`waveButton ${isMining ? 'inProgress': ''}`} onClick={wave} disabled={isMining}>
              {isMining ? "Wave in progress" : "Wave at Me"}
            </button>
          </div>
          {waveCount !== null && <p>Total Wave Count: <span>{waveCount}</span></p>}
          </>
        )}

        {
          lastTxn && <a href={`https://rinkeby.etherscan.io/tx/${lastTxn}`} target="_blank">See Transaction Status</a>
        }

        <div className="all-waves">
          { allWaves.length === 0 && <p className="zeroWaves">It's so lonely here! Nobody has waved at you yet. :(</p>}
          
          {allWaves.map((wave, index) => {
            return (
              <div key={index} style={{ backgroundColor: "OldLace", marginTop: "16px", padding: "8px" }}>
                <div>Address: {wave.address}</div>
                <div>Time: {wave.timestamp.toString()}</div>
                <div>Message: {wave.message}</div>
              </div>)
          })}
        </div>
      </div>
    </div>
  );
}
