"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEmbedChannel = exports.loadBans = exports.loadEmojis = exports.loadAFK = exports.loadChannels = exports.loadRoles = exports.loadConfig = void 0;
const discord_js_1 = require("discord.js");
const util_1 = require("./util");
/**
 * Restores the guild configuration
 */
const loadConfig = (guild, backupData) => {
    const configPromises = [];
    if (backupData.name) {
        configPromises.push(guild.setName(backupData.name));
    }
    if (backupData.iconBase64) {
        configPromises.push(guild.setIcon(Buffer.from(backupData.iconBase64, 'base64')));
    }
    else if (backupData.iconURL) {
        configPromises.push(guild.setIcon(backupData.iconURL));
    }
    if (backupData.splashBase64) {
        configPromises.push(guild.setSplash(Buffer.from(backupData.splashBase64, 'base64')));
    }
    else if (backupData.splashURL) {
        configPromises.push(guild.setSplash(backupData.splashURL));
    }
    if (backupData.bannerBase64) {
        configPromises.push(guild.setBanner(Buffer.from(backupData.bannerBase64, 'base64')));
    }
    else if (backupData.bannerURL) {
        configPromises.push(guild.setBanner(backupData.bannerURL));
    }
    if (backupData.verificationLevel) {
        configPromises.push(guild.setVerificationLevel(backupData.verificationLevel));
    }
    if (backupData.defaultMessageNotifications) {
        configPromises.push(guild.setDefaultMessageNotifications(backupData.defaultMessageNotifications));
    }
    const changeableExplicitLevel = guild.features.includes(discord_js_1.GuildFeature.Community);
    if (backupData.explicitContentFilter && changeableExplicitLevel) {
        configPromises.push(guild.setExplicitContentFilter(backupData.explicitContentFilter));
    }
    return Promise.all(configPromises);
};
exports.loadConfig = loadConfig;
/**
 * Restore the guild roles
 */
const loadRoles = async (guild, backupData) => {
    const rolePromises = [];
    
    // Sort roles by position to maintain hierarchy
    const sortedRoles = backupData.roles.sort((a, b) => (a.position || 0) - (b.position || 0));
    
    for (const roleData of sortedRoles) {
        if (roleData.isEveryone) {
            rolePromises.push(
                guild.roles.get(guild.id).edit({
                    name: roleData.name,
                    color: roleData.color,
                    permissions: roleData.permissions,
                    mentionable: roleData.mentionable
                }).catch(error => {
                    console.log(`Error editing @everyone role:`, error.message);
                    return null;
                })
            );
        } else {
            rolePromises.push(
                guild.createRole({
                    name: roleData.name,
                    color: roleData.color,
                    hoist: roleData.hoist,
                    permissions: roleData.permissions,
                    mentionable: roleData.mentionable
                }).catch(error => {
                    console.log(`Error creating role ${roleData.name}:`, error.message);
                    return null;
                })
            );
        }
        
        // Add small delay between role creations to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
    }
    
    return Promise.all(rolePromises);
};
exports.loadRoles = loadRoles;
/**
 * Restore the guild channels
 */
const loadChannels = async (guild, backupData, options) => {
    const allCreations = [];

    // Create categories first
    for (const categoryData of backupData.channels.categories.values()) {
        try {
            const createdCategory = await util_1.loadCategory(categoryData, guild);
            await new Promise(r => setTimeout(r, 300)); // Reduced delay

            // Add channels for this category
            for (const channelData of categoryData.children.values()) {
                allCreations.push(async () => {
                    try {
                        return await util_1.loadChannel(channelData, guild, createdCategory, options);
                    } catch (error) {
                        console.log(`Error creating channel ${channelData.name}:`, error.message);
                        return null;
                    }
                });
            }
        } catch (error) {
            console.log(`Error creating category ${categoryData.name}:`, error.message);
        }
    }

    // Add channels without category
    backupData.channels.others.forEach((channelData) => {
        allCreations.push(async () => {
            try {
                return await util_1.loadChannel(channelData, guild, null, options);
            } catch (error) {
                console.log(`Error creating channel ${channelData.name}:`, error.message);
                return null;
            }
        });
    });

    // Process channels in smaller batches with better error handling
    for (let i = 0; i < allCreations.length; i += 3) {
        const batch = allCreations.slice(i, i + 3);
        try {
            await Promise.all(batch.map(fn => fn()));
            await new Promise(r => setTimeout(r, 2000)); // Reduced delay
        } catch (error) {
            console.log('Error in channel batch creation:', error.message);
            // Continue with next batch even if current fails
        }
    }
};
exports.loadChannels = loadChannels;
/**
 * Restore the afk configuration
 */
const loadAFK = (guild, backupData) => {
    const afkPromises = [];
    if (backupData.afk) {
        afkPromises.push(guild.setAFKChannel(guild.channels.find((ch) => ch.name === backupData.afk.name && ch.type === discord_js_1.ChannelType.GuildVoice)));
        afkPromises.push(guild.setAFKTimeout(backupData.afk.timeout));
    }
    return Promise.all(afkPromises);
};
exports.loadAFK = loadAFK;
/**
 * Restore guild emojis
 */
const loadEmojis = (guild, backupData) => {
    const emojiPromises = [];
    backupData.emojis.forEach((emoji) => {
        if (emoji.url) {
            emojiPromises.push(guild.createEmoji(
                emoji.url,
                emoji.name
            ));
        }
        else if (emoji.base64) {
            emojiPromises.push(guild.createEmoji(
                Buffer.from(emoji.base64, 'base64'),
                emoji.name,
            ));
        }
    });
    return Promise.all(emojiPromises);
};
exports.loadEmojis = loadEmojis;
/**
 * Restore guild bans
 */
const loadBans = (guild, backupData) => {
    const banPromises = [];
    backupData.bans.forEach((ban) => {
        banPromises.push(guild.members.ban(ban.id, {
            reason: ban.reason
        }));
    });
    return Promise.all(banPromises);
};
exports.loadBans = loadBans;
/**
 * Restore embedChannel configuration
 */
const loadEmbedChannel = (guild, backupData) => {
    const embedChannelPromises = [];
    if (backupData.widget.channel) {
        embedChannelPromises.push(guild.setWidgetSettings({
            enabled: backupData.widget.enabled,
            channel: guild.channels.find((ch) => ch.name === backupData.widget.channel)
        }));
    }
    return Promise.all(embedChannelPromises);
};
exports.loadEmbedChannel = loadEmbedChannel;
