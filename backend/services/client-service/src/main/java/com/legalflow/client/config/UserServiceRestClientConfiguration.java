package com.legalflow.client.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class UserServiceRestClientConfiguration {

    @Bean
    @Qualifier("userServiceRestClient")
    public RestClient userServiceRestClient(@Value("${USER_SERVICE_URL:http://user-service:8090}") String userServiceUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(3));
        requestFactory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder()
                .baseUrl(userServiceUrl)
                .requestFactory(requestFactory)
                .build();
    }
}
