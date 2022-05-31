import type { NextPage } from 'next'
import {
  Text,
  Heading,
  Image,
  Box,
  Button,
  Input,
  Stack
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { useAccount, useConnect, useNetwork } from 'wagmi'
import axios, { AxiosError } from 'axios'
import Link from 'next/link'
import useTranslation from 'next-translate/useTranslation'
import { Layout } from '@/components/layouts/layout'
import { useMounted } from '@/hooks/useMounted'
import { useKeywordSubmit } from '@/hooks/quest/useKeywordSubmit'
import { useHasNFT } from '@/hooks/useHasNFT'
import { useBalanceOf } from '@/hooks/useBalanceOf'
import { useTokenIdOf } from '@/hooks/useTokenIdOf'
import { useTokenURI } from '@/hooks/useTokenURI'
import { getContractAddress } from '@/utils/contractAddress'
import { useGetPoint } from '@/hooks/quest/useGetPoint'
import { useUpdateOwnNFT } from '@/hooks/useUpdateOwnNFT'
import { useToast } from '@/hooks/useToast'

interface TokenAttribute {
  display_type: string | undefined
  trait_type: string
  value: number | string
}
interface KamonToken {
  name: string
  description: string
  image: string
  attributes: TokenAttribute[]
}

const Quests: NextPage = () => {
  const { t } = useTranslation('common')
  const { toast } = useToast()
  const ipfsApiEndpoint = process.env.NEXT_PUBLIC_IPFS_API_URI + ''
  const mounted = useMounted()
  const { connect, connectors } = useConnect()
  const [metaMask] = connectors
  const { data } = useAccount()
  const { keyword, inputChange, submit, isSubmitting } = useKeywordSubmit()
  const { hasNFT } = useHasNFT()
  const { activeChain } = useNetwork()
  const kamonNFT = getContractAddress({
    name: 'kamonNFT',
    chainId: activeChain?.id
  })
  const { balanceOf } = useBalanceOf(kamonNFT, data?.address)
  const { tokenIdOf } = useTokenIdOf(kamonNFT, data?.address)
  const { tokenURI } = useTokenURI(kamonNFT, tokenIdOf?.toNumber() || 0)
  const { point, refetchPoint } = useGetPoint()
  const [tokenImageURI, setTokenImageURI] = useState('')
  const [tokenId, setTokenId] = useState<BigInt>(BigInt(0))
  const [tokenJSON, setTokenJSON] = useState<KamonToken>()
  const [finalTokenUri, setFinalTokenUri] = useState('')
  const [newTokenImageURI, setNewTokenImageURI] = useState('')
  const [newTokenJSON, setNewTokenJSON] = useState<KamonToken>()
  const [stillProcessingSomething, setStillProcessingSomething] = useState(false)
  const [questSubmitted, setQuestSubmitted] = useState(false)
  const [questReturned, setQuestReturned] = useState(false)
  const [ipfsSubmitted, setIpfsSubmitted] = useState(false)
  const [ipfsReturned, setIpfsReturned] = useState(false)
  const [newTokenRequestSubmitted, setNewTokenRequestSubmitted] = useState(false)
  const [newTokenRequestReturned, setNewTokenRequestReturned] = useState(false)
  const [updateOwnNftSubmitted, setUpdateOwnNftSubmitted] = useState(false)
  const [updateOwnNftReturned, setUpdateOwnNftReturned] = useState(false)

  const { update, isError, updated } = useUpdateOwnNFT(
    kamonNFT,
    tokenId,
    finalTokenUri,
  )

  const resetFlags = () => {
    setStillProcessingSomething(false)
    setQuestSubmitted(false)
    setQuestReturned(false)
    setIpfsSubmitted(false)
    setIpfsReturned(false)
    setNewTokenRequestSubmitted(false)
    setNewTokenRequestReturned(false)
  }

  useEffect(() => {
    if (balanceOf && tokenIdOf && tokenURI) {
      const fetchData = async () => {
        const pinataRequest = await fetch(tokenURI.toString())
        const responseJson = await pinataRequest.json()

        setTokenImageURI(responseJson.image)
        setTokenJSON(responseJson)
      }

      fetchData()
    }
  }, [balanceOf, tokenIdOf, tokenURI])

  // Manage when the quest starts and finishes submitting
  useEffect(() => {
    if (isSubmitting == true) {
      resetFlags()
      setFinalTokenUri('')
      setNewTokenImageURI('')
      setStillProcessingSomething(true)
      setQuestSubmitted(true)
    } else if (questSubmitted) {
      setQuestReturned(true)
    }
  }, [isSubmitting, questSubmitted])

  // Manage the IPFS request after the quest returns
  useEffect(() => {
    if (questReturned == true && ipfsSubmitted == false && finalTokenUri == '') {
      const hitIpfsApi = async () => {
        setIpfsSubmitted(true)
        let dateFromToken = 0
        let rolesFromToken: string[] = []
        const onTokenPointsAttr: TokenAttribute | undefined = tokenJSON?.attributes.find(elem => elem.trait_type == 'Points')
        const onTokenPoints = onTokenPointsAttr?.value
        // console.log('point value on token', onTokenPoints)
        const updatedPointsQuery = await refetchPoint()
        const updatedPoints = Array.isArray(updatedPointsQuery.data)? updatedPointsQuery.data[0]: 0
        const updatedPointsInt = parseInt(updatedPoints.toString())
        // console.log('new point value', updatedPointsInt)
        if(onTokenPoints == updatedPointsInt) {
          // console.log('No need to update the NFT')
          resetFlags()
          setFinalTokenUri('')
          setNewTokenImageURI('')
          return // Comment for debugging
        }
        tokenJSON?.attributes.forEach((attr: TokenAttribute) => {
          if (attr.trait_type == 'Date') {
            dateFromToken = parseInt(attr.value.toString())
          } else if (attr.trait_type == 'Role') {
            rolesFromToken.push(attr.value.toString())
          }
        })
        const payload = {
          address: data?.address,
          roles: rolesFromToken,
          points: updatedPointsInt,
          date: dateFromToken,
        }

        toast({
          title: 'Updating Kamon NFT',
          description: 'Generating an image with your new point total. Please wait...',
          status: 'info'
        })
        try {
          const ipfsRequest = await axios.post(ipfsApiEndpoint, payload, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
          setIpfsReturned(true)
          const TempfinalTokenUri = await ipfsRequest.data.tokenUri
          setFinalTokenUri(TempfinalTokenUri)
          // console.log('finalTokenUri', TempfinalTokenUri)
        } catch (err) {
          const error = err as Error | AxiosError;
          let title = ''
          if(axios.isAxiosError(error)){
            title = 'Error ' + error?.response?.status
          } else {
            title = 'Error'
          }
          toast({
            title: title,
            description: 'Could not generate your new image.',
            status: 'error'
          })
          // console.log('Error on setIpfsSubmitted', error)
          resetFlags()
        }
      }
      hitIpfsApi()
    }
  }, [questReturned, data?.address, point, tokenJSON, ipfsApiEndpoint, refetchPoint, finalTokenUri, ipfsSubmitted, toast])

  // Manage the new token request after the quest returns
  useEffect(() => {
    if (ipfsReturned == true && newTokenRequestSubmitted == false && newTokenJSON == undefined) {
      const getNewToken = async () => {
        setNewTokenRequestSubmitted(true)
        try {
          const newTokenRequest = await axios.get(finalTokenUri)
          setNewTokenJSON(newTokenRequest.data)
          setNewTokenRequestReturned(true)
        } catch (err) {
          const error = err as Error | AxiosError;
          let title = ''
          if(axios.isAxiosError(error)){
            title = 'Error ' + error?.response?.status
          } else {
            title = 'Error'
          }
          toast({
            title: title,
            description: 'Could not get the data for your token.',
            status: 'error'
          })
          // console.log('Error on getNewToken', error)
          resetFlags()
        }
      }
      getNewToken()
    }
  }, [newTokenJSON, finalTokenUri, ipfsReturned, newTokenRequestSubmitted, toast])

  // Get the new token image URI from the updated token
  useEffect(() => {
    if (newTokenRequestReturned == true) {
      // console.log('newTokenJSON', newTokenJSON)
      if(newTokenJSON !== undefined) {
        const theTokenId = tokenIdOf? tokenIdOf: BigInt(0)
        if(theTokenId == BigInt(0)) { return }
        setTokenId(BigInt(parseInt(theTokenId.toString())))
        setNewTokenImageURI(newTokenJSON.image)
      }
    }
  }, [newTokenRequestReturned, newTokenJSON, newTokenImageURI, tokenIdOf, tokenId])

  // Call updateOwnNFT on the contract to update oru own token's URI
  useEffect(() => {
    if (
      newTokenRequestReturned == true
      && updateOwnNftSubmitted !== true
      && finalTokenUri !== undefined
      && updated !== true
      && tokenId !== BigInt(0)
    ) {
      const updateToken = async () => {
        setUpdateOwnNftSubmitted(true)
        // console.log('Updating own NFT with', tokenId.toString(), finalTokenUri)
        try {
          const updateResponse = await update()
          // console.log('updateResponse returned', updateResponse)
          setUpdateOwnNftReturned(true)
          toast({
            title: 'Kamon updated',
            description: 'NFT metadata and image successfully updated.',
            status: 'success'
          })
        } catch (err) {
          const error = err as Error;
          if (error.name == 'UserRejectedRequestError') {
            toast({
              title: 'Transaction Rejected',
              description: 'You rejected the transaction. Please retry if you want to update your Kamon.',
              status: 'error'
            })
          } else {
            toast({
              title: 'Error',
              description: 'The transaction failed.',
              status: 'error'
            })
          }
          // console.log('Error on updateToken', error)
        }
        resetFlags()
      }
      updateToken()
    }
  }, [newTokenRequestReturned, updateOwnNftSubmitted, finalTokenUri, updated, update, tokenId, tokenIdOf, toast])

  const submitForm = () => {
    setStillProcessingSomething(true)
    submit()
  }

  return (
    <>
      <Layout>
        <Heading mt={50}>{t('QUEST.HEADING')}</Heading>
        <Box display={{ md: 'flex', xl: 'flex' }}>
          <Box p={2} minW={300}>
            <Image
              src="/joi-ito-henkaku-podcast.png"
              alt="{t('QUEST.IMAGE_ALT')}"
            />
          </Box>
          <Box p={2}>
            <Box w="100%" p={4}>
              {hasNFT ? (
                <>
                  <Heading size="md">{t('QUEST.EXPLANATION_HEADING')}</Heading>
                  <Text>{t('QUEST.EXPLANATION_BODY')}</Text>
                </>
              ) : (
                <>
                  <Heading size="md">
                    {t('QUEST.MINT_YOUR_KAMON_HEADING')}
                  </Heading>
                  <Text>{t('QUEST.MINT_YOUR_KAMON_EXPLANATION')}</Text>
                </>
              )}
            </Box>

            {mounted && !data?.address && !hasNFT ? (
              <Button
                mt={10}
                w="100%"
                colorScheme="teal"
                onClick={() => connect(metaMask)}
              >
                {t('CONNECT_WALLET_BUTTON')}
              </Button>
            ) : hasNFT ? (
              <Box mt={4}>
                <Stack>
                  <Input
                    placeholder={t('QUEST.INPUT_PLACEHOLDER')}
                    onChange={inputChange}
                    textTransform="uppercase"
                  />

                  <Button
                    mt={10}
                    w="100%"
                    colorScheme="teal"
                    onClick={() => submitForm()}
                    isLoading={stillProcessingSomething}
                    loadingText={t('BUTTON_SUBMITTING')}
                    disabled={keyword == '' || stillProcessingSomething}
                  >
                    {t('QUEST.SUBMIT_BUTTON')}
                  </Button>
                </Stack>
              </Box>
            ) : (
              <Link href="/" passHref>
                <Button mt={10} w="100%" colorScheme="teal">
                  {t('QUEST.MINT_BUTTON')}
                </Button>
              </Link>
            )}
          </Box>
        </Box>
      </Layout>
    </>
  )
}

export default Quests
