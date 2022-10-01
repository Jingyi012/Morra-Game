'reach 0.1';

const [ finalOutcome, A_WINS, B_WINS, DRAW ] = makeEnum(3);

const winner = (handA, handB, guessA, guessB) =>{
  if(guessA == guessB)
  {
    return DRAW;
  }
  else
  {
    if((handA + handB) == guessA)
    {
      return A_WINS;
    }
    else 
    {
      if((handA + handB) == guessB)
      {
        return B_WINS;
      }
      else
      {
        return DRAW;
      }
    }
  }
}
assert(winner(2,2,2,2) == DRAW);
assert(winner(0,1,2,3) == DRAW);
assert(winner(0,1,0,1) == B_WINS);
assert(winner(1,0,1,0) == A_WINS);

forall(UInt, handA =>
  forall(UInt, handB =>
    forall(UInt, guessA =>
      forall(UInt, guessB =>
        assert(finalOutcome(winner(handA, handB, guessA, guessB)))))))

forall(UInt, handA =>
  forall(UInt, handB =>
    forall(UInt, (guess) =>
      assert(winner(handA, handB, guess, guess) == DRAW))))

const Player = {
  ...hasRandom,
  getHand: Fun([], UInt),
  getGuess: Fun([], UInt),
  seeOutcome: Fun([UInt], Null),
  informTimeout: Fun([], Null),
}

export const main = Reach.App(() => {
  const Alice = Participant('Alice', {
    // Specify Alice's interact interface here
    ...Player,
    wager: UInt,
    deadline: UInt,
  });
  const Bob = Participant('Bob', {
    // Specify Bob's interact interface here
    ...Player,
    acceptWager: Fun([UInt], Null),
  });
  
  init();
  
  const informTimeout = () => {
    each([Alice, Bob], () => {
      interact.informTimeout();
    })
  }

  Alice.only(()=>{
    const wager = declassify(interact.wager);
    const deadline = declassify(interact.deadline);
  })
  Alice.publish(wager, deadline)
  .pay(wager);
  commit();

  Bob.interact.acceptWager(wager);
  Bob.pay(wager)
  .timeout(relativeTime(deadline), () => closeTo(Alice, informTimeout))
  
  var outcome = DRAW;
  invariant(balance() == 2 * wager && finalOutcome(outcome))
  while(outcome == DRAW){
    commit();

    Alice.only(()=>{
      const _handAlice = interact.getHand();
      const _guessAlice = interact.getGuess();
      
      const [_commitAlice, _saltAlice] = makeCommitment(interact, _handAlice);
      const commitAlice = declassify(_commitAlice);
      
      const [_commitGuessAlice, _saltGuessAlice] = makeCommitment(interact, _guessAlice);
      const commitGuessAlice = declassify(_commitGuessAlice);
    });
    Alice.publish(commitAlice, commitGuessAlice)
    .timeout(relativeTime(deadline), () => closeTo(Bob, informTimeout))
    commit();

    unknowable(Bob, Alice(_handAlice, _saltAlice, _guessAlice,_saltGuessAlice));
    Bob.only(()=>{
      const handBob = declassify(interact.getHand());
      const guessBob = declassify(interact.getGuess());
    })
    Bob.publish(handBob, guessBob)
    .timeout(relativeTime(deadline), () => closeTo(Alice, informTimeout));
    commit();

    Alice.only(()=>{
      const saltAlice = declassify(_saltAlice);
      const handAlice = declassify(_handAlice);
      const saltGuessAlice = declassify(_saltGuessAlice);
      const guessAlice = declassify(_guessAlice);
    })
    Alice.publish(saltAlice, handAlice, saltGuessAlice, guessAlice)
    .timeout(relativeTime(deadline), () => closeTo(Bob, informTimeout));

    checkCommitment(commitAlice, saltAlice, handAlice);
    checkCommitment(commitGuessAlice, saltGuessAlice, guessAlice);

    outcome = winner(handAlice, handBob, guessAlice, guessBob);
    continue;
  }

  assert(outcome == A_WINS || outcome == B_WINS);
  transfer(2 * wager).to(outcome == A_WINS ? Alice : Bob);
  commit();
  
  each([Alice, Bob], ()=>{
    interact.seeOutcome(outcome)
  });
  exit();
});
