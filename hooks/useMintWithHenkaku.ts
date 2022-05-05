import { ethers } from 'ethers'
import { useNetwork, useContractWrite } from 'wagmi'
import { useCallback } from 'react'
import kamonNFTContract from '@/abis/kamonNFT.json'
import { getContractAddress } from 'utils/contractAddress'

export const useMintWithHenkaku = (tokenUri: string, amount: number) => {
  const { activeChain } = useNetwork()
  const kamonNFT = getContractAddress({
    name: 'kamonNFT',
    chainId: activeChain?.id
  })

  const {
    data: mintData,
    isError,
    isLoading: isMinting,
    write: mint
  } = useContractWrite(
    {
      addressOrName: kamonNFT,
      contractInterface: kamonNFTContract.abi
    },
    'mintWithHenkaku',
    {
      args: [tokenUri, ethers.utils.parseEther(amount.toString())]
    }
  )

  return {
    mintData,
    isError,
    isMinting,
    mint
  }
}
