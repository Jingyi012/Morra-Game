import React from 'react';
import AppViews from './views/AppViews';
import DeployerViews from './views/DeployerViews';
import AttacherViews from './views/AttacherViews';
import { renderDOM, renderView } from './views/render';
import './index.css';
import * as backend from './build/index.main.mjs';
import { ask, loadStdlib } from '@reach-sh/stdlib';
const reach = loadStdlib(process.env);

import { ALGO_MyAlgoConnect as MyAlgoConnect } from '@reach-sh/stdlib';
reach.setWalletFallback(reach.walletFallback({
  providerEnv: 'TestNet', MyAlgoConnect }));

const intToOutcome = ['Alice wins!', 'Bob wins!', 'Draw'];
const handToInt = {'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5};
const guessToInt = {'0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10};
const {standardUnit} = reach;
const defaults = {defaultFundAmt: '10', defaultWager: '1', standardUnit};

class App extends React.Component{
  constructor(props){
    super(props);
    this.state = {view: 'ConnectAccount', ...defaults};
  }
  async componentDidMount(){
    const acc = await reach.getDefaultAccount();
    const balAtomic = await reach.balanceOf(acc);
    const bal = reach.formatCurrency(balAtomic, 4);
    this.setState({acc, bal});
    if(await reach.canFundFromFaucet()){
      this.setState({view: 'FundAccount'});
    } else {
      this.setState({view: 'DeployerOrAttacher'});
    }
  }
  async fundAccount(fundAmount){
    await reach.fundFromFaucet(this.state.acc, reach.parseCurrency(fundAmount));
    this.setState({view: 'DeployerOrAttacher'});
  }
  async skipFundAccount(){ this.setState({view: 'DeployerOrAttacher'}); }
  selectAttacher(){ this.setState({view: 'Wrapper', ContentView: Attacher}); }
  selectDeployer() { this.setState({view: 'Wrapper', ContentView: Deployer}); }
  render(){ return renderView(this, AppViews); }
}

class Player extends React.Component{
  random(){ return reach.hasRandom.random(); }
  async getHand(){
    const hand = await new Promise(resolvedHandP => {
      this.setState({view: 'GetHand', playable: true, resolvedHandP});
    });
    this.setState({view: 'WaitingForResults', hand});
    return handToInt[hand];
  }
  playHand(hand){ this.state.resolvedHandP(hand); }

  async getGuess(){ 
    const guess = await new Promise(resolvedGuessP => {
      this.setState({view: 'GetGuess', playable: true, resolvedGuessP});
    });
    this.setState({view: 'WaitingForResults', guess});
    return guessToInt[guess];
  }
  playGuess(guess){ this.state.resolvedGuessP(guess); }

  seeOutcome(out){ this.setState({view: 'Done', outcome: intToOutcome[out]}); }
  informTimeout(){ this.setState({view: 'Timeout'}); }
}

class Deployer extends Player {
  constructor(props){
    super(props);
    this.state = { view: 'SetWager' };
  }
  setWager(wager){ this.setState({view:'Deploy', wager}); }
  async deploy(){
    const ctc = this.props.acc.contract(backend);
    this.setState({view: 'Deploying', ctc});
    this.wager = reach.parseCurrency(this.state.wager);
    this.deadline = { ETH: 10, ALGO: 100, CFX: 1000}[reach.connector];
    backend.Alice(ctc, this);
    const ctcInfoStr = JSON.stringify(await ctc.getInfo(), null, 2);
    this.setState({view:'WaitingForAttacher', ctcInfoStr});
  }
  render(){ return renderView(this, DeployerViews); }
}

class Attacher extends Player{
  constructor(props){
    super(props);
    this.state = {view: 'Attach'};
  }
  attach(ctcInfoStr){
    const ctc = this.props.acc.contract(backend, JSON.parse(ctcInfoStr));
    this.setState({view: 'Attaching'});
    backend.Bob(ctc, this);
  }
  async acceptWager(wagerAtomic){
    const wager = reach.formatCurrency(wagerAtomic, 4);
    return await new Promise(resolvedAcceptedP => {
      this.setState({view:'AcceptTerms', wager, resolvedAcceptedP});
    });
  }
  termsAccepted(){
    this.state.resolvedAcceptedP();
    this.setState({view: 'WaitingForTurn'});
  }
  render(){ return renderView(this, AttacherViews); }
}

renderDOM(<App />);