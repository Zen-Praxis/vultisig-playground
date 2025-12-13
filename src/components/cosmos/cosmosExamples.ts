export const getExampleMsgs = (signer: string) => ({
  singleSend: [
    {
      type: 'cosmos-sdk/MsgSend',
      value: {
        amount: [
          {
            amount: '1000',
            denom: 'uatom',
          },
        ],
        from_address: signer || 'cosmos1...',
        to_address: signer || 'cosmos1...',
      },
    },
  ],
  multiSend: [
    {
      type: 'cosmos-sdk/MsgSend',
      value: {
        amount: [
          {
            amount: '1000',
            denom: 'uatom',
          },
        ],
        from_address: signer || 'cosmos1...',
        to_address: signer || 'cosmos1...',
      },
    },
    {
      type: 'cosmos-sdk/MsgSend',
      value: {
        amount: [
          {
            amount: '2000',
            denom: 'uatom',
          },
        ],
        from_address: signer || 'cosmos1...',
        to_address: signer || 'cosmos1...',
      },
    },
    {
      type: 'cosmos-sdk/MsgSend',
      value: {
        amount: [
          {
            amount: '3000',
            denom: 'uatom',
          },
        ],
        from_address: signer || 'cosmos1...',
        to_address: signer || 'cosmos1...',
      },
    },
  ],
})

