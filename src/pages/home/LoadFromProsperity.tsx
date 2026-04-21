import { Anchor, Button, Code, Kbd, PasswordInput, Select, Text, TextInput } from '@mantine/core';
import { AxiosResponse } from 'axios';
import { FormEvent, ReactNode, useCallback, useState } from 'react';
import { ErrorAlert } from '../../components/ErrorAlert.tsx';
import { useAsync } from '../../hooks/use-async.ts';
import { AlgorithmSummary } from '../../models.ts';
import { useStore } from '../../store.ts';
import { authenticatedAxios } from '../../utils/axios.ts';
import { formatTimestamp } from '../../utils/format.ts';
import { AlgorithmList } from './AlgorithmList.tsx';
import { HomeCard } from './HomeCard.tsx';

export function LoadFromProsperity(): ReactNode {
  /*
  Raw bookmarklet code:
  void function(){
    if("prosperity.imc.com"!==window.location.hostname){
      alert("This bookmarklet should only be used on prosperity.imc.com");
    } else {
      const a=Object.keys(window.localStorage).find(a=>a.endsWith(".idToken"));
      if(a===void 0){
        alert("ID token not found. Make sure you are logged in to prosperity.imc.com.");
      } else {
        const t=window.localStorage.getItem(a);
        if(navigator.clipboard){
          navigator.clipboard.writeText(t).then(
            ()=>alert("ID token copied to clipboard!"),
            ()=>prompt("Copy your ID token:",t)
          );
        } else {
          prompt("Copy your ID token:",t);
        }
      }
    }
  }();

  Fixed vs P3 original: added prompt() fallback for browsers that block
  clipboard access from bookmarklets (Firefox, some Chrome configs).
  */
  const bookmarklet =
    'javascript:void%20function()%7Bif(%22prosperity.imc.com%22!%3D%3Dwindow.location.hostname)%7Balert(%22This%20bookmarklet%20should%20only%20be%20used%20on%20prosperity.imc.com%22)%3B%7Delse%7Bconst%20a%3DObject.keys(window.localStorage).find(a%3D%3Ea.endsWith(%22.idToken%22))%3Bif(a%3D%3D%3Dvoid%200)%7Balert(%22ID%20token%20not%20found.%20Make%20sure%20you%20are%20logged%20in%20to%20prosperity.imc.com.%22)%3B%7Delse%7Bconst%20t%3Dwindow.localStorage.getItem(a)%3Bif(navigator.clipboard)%7Bnavigator.clipboard.writeText(t).then(()%3D%3Ealert(%22ID%20token%20copied%20to%20clipboard!%22)%2C()%3D%3Eprompt(%22Copy%20your%20ID%20token%3A%22%2Ct))%3B%7Delse%7Bprompt(%22Copy%20your%20ID%20token%3A%22%2Ct)%3B%7D%7D%7D%7D()%3B';

  // React shows an error when using "javascript:" URLs without dangerouslySetInnerHTML
  const bookmarkletHtml = `<a href="${bookmarklet}">IMC Prosperity ID Token Retriever</a>`;

  const idToken = useStore(state => state.idToken);
  const setIdToken = useStore(state => state.setIdToken);

  const round = useStore(state => state.round);
  const setRound = useStore(state => state.setRound);

  const [proxy, setProxy] = useState('https://imc-prosperity-3-visualizer-cors-anywhere.jmerle.dev/');

  const loadAlgorithms = useAsync<AlgorithmSummary[]>(async (): Promise<AlgorithmSummary[]> => {
    let response: AxiosResponse<AlgorithmSummary[]>;
    try {
      response = await authenticatedAxios.get(
        `https://bz97lt8b1e.execute-api.eu-west-1.amazonaws.com/prod/submission/algo/${round}`,
      );
    } catch (err: any) {
      if (err.response?.status === 403) {
        throw new Error('ID token is invalid, please change it.');
      }

      throw err;
    }

    return response.data.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  });

  const onSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();

      if (idToken.trim().length > 0) {
        loadAlgorithms.call();
      }
    },
    [loadAlgorithms],
  );

  const now = Date.now();
  const rounds = [
    { value: 'ROUND0', label: 'Tutorial', openFrom: '2026-03-16T10:00:00.000Z' },
    { value: 'ROUND1', label: 'Round 1', openFrom: '2026-04-14T10:00:00.000Z' },
    { value: 'ROUND2', label: 'Round 2', openFrom: '2026-04-17T10:00:00.000Z' },
    { value: 'ROUND3', label: 'Round 3', openFrom: '2026-04-20T10:00:00.000Z' },
    { value: 'ROUND4', label: 'Round 4', openFrom: '2026-04-23T10:00:00.000Z' },
    { value: 'ROUND5', label: 'Round 5', openFrom: '2026-04-26T10:00:00.000Z' },
  ].map(round => {
    const disabled = Date.parse(round.openFrom) > now;
    const label = disabled ? `${round.label} - Available from ${formatTimestamp(round.openFrom)}` : round.label;

    return {
      value: round.value,
      label,
      disabled,
    };
  });

  return (
    <HomeCard title="Load from Prosperity">
      <Text>
        Connects directly to the{' '}
        <Anchor href="https://prosperity.imc.com/game" target="_blank" rel="noreferrer">
          Prosperity 4
        </Anchor>{' '}
        API using your ID token — the same token the Prosperity website uses internally. The token is stored in your
        browser&apos;s local storage under a key matching{' '}
        <Code>CognitoIdentityServiceProvider.&lt;id&gt;.&lt;email&gt;.idToken</Code>.
      </Text>
      <Text>
        <strong>Easiest way:</strong> drag the bookmarklet below into your browser&apos;s bookmarks bar, then click it
        while on{' '}
        <Anchor href="https://prosperity.imc.com/game" target="_blank" rel="noreferrer">
          prosperity.imc.com
        </Anchor>
        . It will copy the token to your clipboard (or show a prompt if clipboard access is blocked).
        <br />
        <span dangerouslySetInnerHTML={{ __html: bookmarkletHtml }} />
      </Text>
      <Text>
        <strong>Manual way:</strong> open DevTools (<Kbd>F12</Kbd>), go to the <i>Application</i> (Chrome) /{' '}
        <i>Storage</i> (Firefox) tab → Local Storage → <Code>prosperity.imc.com</Code>, and find the key ending in{' '}
        <Code>.idToken</Code>.
      </Text>
      <Text>
        Tokens expire after a few hours — you&apos;ll need to refresh this field periodically. Your token is only used
        to communicate with the Prosperity API and is never sent elsewhere.
      </Text>
      {/* prettier-ignore */}
      <Text>
        Downloading logs requires routing through a <Anchor href="https://github.com/Rob--W/cors-anywhere" target="_blank" rel="noreferrer">CORS Anywhere</Anchor> proxy because the Prosperity S3 log URLs don&apos;t include the headers needed for browser cross-origin requests. The default proxy is jmerle&apos;s public instance — if it&apos;s down, host your own or use the file upload approach instead.
      </Text>

      {loadAlgorithms.error && <ErrorAlert error={loadAlgorithms.error} />}

      <form onSubmit={onSubmit}>
        <PasswordInput
          label="ID token"
          placeholder="ID token"
          value={idToken}
          onInput={e => setIdToken((e.target as HTMLInputElement).value)}
        />

        <Select
          label="Round"
          value={round}
          onChange={value => setRound(value!)}
          data={rounds}
          allowDeselect={false}
          mt="xs"
        />

        <TextInput
          label='"Open in visualizer" CORS Anywhere proxy'
          placeholder="Proxy"
          value={proxy}
          onInput={e => setProxy((e.target as HTMLInputElement).value)}
          mt="xs"
        />

        <Button fullWidth type="submit" loading={loadAlgorithms.loading} mt="sm">
          <div>Load algorithms</div>
        </Button>
      </form>

      {loadAlgorithms.success && <AlgorithmList algorithms={loadAlgorithms.result!} proxy={proxy} />}
    </HomeCard>
  );
}
