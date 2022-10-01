import { ask, loadStdlib } from "@reach-sh/stdlib";
import * as backend from './build/index.main.mjs';
const stdlib = loadStdlib();

const isAlice = await ask.ask(
    `Are you Alice?`,
    ask.yesno
);
const who = isAlice ? 'Alice' : 'Bob';

console.log(`Starting Morra Game! as ${who}`);

let acc = null;
const createAcc = await ask.ask(
    `Would you like to create an account?`,
    ask.yesno
);

if(createAcc){
    acc = await stdlib.newTestAccount(stdlib.parseCurrency(1000));
} else {
    const secret = await ask.ask(
        `What is your account secret?`,
        (x => x)
    );
    acc = await stdlib.newAccountFromSecret(secret);
}

let ctc = null;
if(isAlice){
    ctc = acc.contract(backend);
    ctc.getInfo().then((info) => {
        console.log(`The contract is deployed as = ${JSON.stringify(info)}`); });
} else {
    const info = await ask.ask(
        `Please paste the contract information: `,
        JSON.parse
    )
    ctc = acc.contract(backend, info);
}

const fmt = (x) => stdlib.formatCurrency(x, 4);
const getBalance = async() =>fmt(await stdlib.balanceOf(acc));

const before = await getBalance();
console.log(`Your balance is ${before}`);

const interact = {...stdlib.hasRandom};

interact.informTimeout = () => {
    console.log(`There was a timeout.`);
    process.exit(1);
}

if(isAlice){
    const amt = await ask.ask(
        `How much do you want to wager?`,
        stdlib.parseCurrency
    );
    interact.wager = amt;
    interact.deadline = { ETH: 10, ALGO: 100, CFX: 1000 }[stdlib.connector];
} else {
    interact.acceptWager = async(amt) => {
        const accepted = ask.ask(
            `Do you accept the wager of ${fmt(amt)}?`,
            ask.yesno
        );
        if(!accepted){
            process.exit(0);
        }
    }
}

const HAND = [0,1,2,3,4,5];
const GUESS = [0,1,2,3,4,5,6,7,8,9,10];

interact.getHand = async () => {
    const hand = await ask.ask(
        `What hand will you play? (0-5)`, (x)=>{
            const hand = x;
            if(hand > 5 || hand < 0){
                throw Error(`Not a valid hand`);
            }
            return hand;
        }
    );
    console.log(`You played ${hand}.`);
    return hand;
}

interact.getGuess= async () => {
    const guess = await ask.ask(`What is your guess for the total?`);
    console.log(`You guessed ${guess} total.`);
    return guess;
}

interact.seeWinningNum = num => {
    console.log(`The winning number is ${num}.`);
}

const OUTCOME = ['Alice wins', 'Bob wins', 'Draw'];
interact.seeOutcome = (out) => {
    console.log(`The outcome is ${OUTCOME[out]}.`);
}

const part = isAlice ? ctc.p.Alice : ctc.p.Bob;
await part(interact);

const after = await getBalance();
console.log(`Your balance is now ${after}.`);

ask.done;