# Truster Challenge – Damn Vulnerable DeFi

This challenge demonstrates how insecure use of flash loans with arbitrary external calls can lead to a complete drain of funds from a lending pool.

## 🧠 The Vulnerability

The `TrusterLenderPool` smart contract allows users to take a flash loan and simultaneously perform **any external call** via the `target` and `data` parameters.

Critically, it does **not validate** what function is being called on the `target`, allowing an attacker to:

- Call `approve()` on the ERC20 token contract
- Grant themselves approval to spend the pool's tokens
- Then simply `transferFrom()` all tokens out of the pool

## ⚔️ The Exploit

1. Encode a call to `approve(attacker, 1_000_000 ether)`
2. Execute it via `flashLoan()` using the token as the target
3. After the flash loan call, use `transferFrom()` to move tokens to the attacker's address

## 🛠️ Steps to Reproduce (in Remix)

1. Deploy `DamnValuableToken`
2. Deploy `TrusterLenderPool`, passing the token address
3. Transfer `1,000,000 DVT` tokens to the pool
4. Deploy `TrusterExploit`
5. Call `attack(poolAddress, tokenAddress)` from the exploit contract

## ✅ Success Criteria

- The lending pool's balance is drained to `0`
- All tokens are transferred to the attacker's address (or recovery address)

## 📁 Files

- `DamnValuableToken.sol` – ERC20 token used in the challenge
- `TrusterLenderPool.sol` – Vulnerable lending pool contract
- `TrusterExploit.sol` – Exploit contract

---

🔒 **Lesson Learned**: Never allow arbitrary external calls in sensitive functions like flash loans without strict validation or access control.
