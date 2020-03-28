import * as common from './common.js';

const route = common.route;

export async function login(request: common.LoginRequest): Promise<common.LoginResponse> {
	const response = await performRequest<common.LoginResponse>(route.login, request);
	return response;
}

export async function logout() {
	const request = {};
	await performRequest<void>(route.logout, request);
}

export async function validateSession(): Promise<common.ValidateSessionResponse> {
	const request = {};
	const response = await performRequest<common.ValidateSessionResponse>(route.validateSession, request);
	return response;
}

export async function getSites(): Promise<common.GetSitesResponse> {
	const request = {};
	const response = await performRequest<common.GetSitesResponse>(route.getSites, request);
	return response;
}

export async function browse(request: common.BrowseRequest): Promise<common.BrowseResponse> {
	const response = await performRequest<common.BrowseResponse>(route.browse, request);
	return response;
}

export async function search(request: common.SearchRequest): Promise<common.BrowseResponse> {
	const response = await performRequest<common.BrowseResponse>(route.search, request);
	return response;
}

export async function download(request: common.DownloadRequest) {
	await performRequest<void>(route.download, request);
}

export async function getTorrents(): Promise<common.GetTorrentsResponse> {
	const request = {};
	const response = await performRequest<common.GetTorrentsResponse>(route.getTorrents, request);
	return response;
}

export async function getSubscriptions(request: common.GetSubscriptionRequest): Promise<common.GetSubscriptionResponse> {
	const response = await performRequest<common.GetSubscriptionResponse>(route.getSubscriptions, request);
	return response;
}

export async function createSubscription(request: common.CreateSubscriptionRequest): Promise<common.CreateSubscriptionResponse> {
	const response = await performRequest<common.CreateSubscriptionResponse>(route.createSubscription, request);
	return response;
}

export async function deleteSubscription(request: common.CreateSubscriptionRequest) {
	await performRequest<void>(route.deleteSubscription, request);
}

async function performRequest<ResponseType>(path: string, request: any): Promise<ResponseType> {
	const xmlHttpRequest = new XMLHttpRequest();
	xmlHttpRequest.open('POST', `/api${path}`);
	xmlHttpRequest.setRequestHeader('Content-Type', 'application/json');
	const body = JSON.stringify(request);
	xmlHttpRequest.send(body);
	const response = await new Promise<ResponseType>((resolve, reject) => {
		xmlHttpRequest.onload = event => {
			const response = JSON.parse(xmlHttpRequest.responseText);
			const errorMessage = response.error;
			if (errorMessage == null) {
				resolve(<ResponseType>response);
			}
			else {
				reject(errorMessage);
			}
		};
		xmlHttpRequest.onerror = event => {
			reject(`Failed to call API "${path}".`);
		};
	});
	return response;
}